import { PrismaClient } from '@prisma/client';
import prisma from '../lib/prisma';
import { sendTextMessage, sendTemplateMessage, WAMessageComponent } from './whatsapp';

export interface AutomationTrigger {
  type: 'keyword' | 'new_conversation' | 'no_reply' | 'label_added' | 'conversation_resolved';
  value?: string;
  conversationId: string;
  teamId: string;
  messageContent?: string;
}

export interface AutomationAction {
  type:
    | 'send_message'
    | 'assign_to'
    | 'add_label'
    | 'remove_label'
    | 'resolve'
    | 'reopen'
    | 'send_template'
    | 'add_tag'
    | 'set_priority';
  value: string | number | null;
}

export interface AutomationRule {
  type: string;
  value?: string;
}

/**
 * Process automations for a given trigger event.
 * Finds all active automations in the team that match the trigger and executes their actions.
 */
export async function processAutomations(trigger: AutomationTrigger): Promise<void> {
  try {
    const automations = await prisma.automation.findMany({
      where: {
        teamId: trigger.teamId,
        isActive: true,
      },
    });

    if (automations.length === 0) return;

    const conversation = await prisma.conversation.findUnique({
      where: { id: trigger.conversationId },
      include: {
        contact: true,
        assignedTo: true,
      },
    });

    if (!conversation) {
      console.warn(`[Automation] Conversation not found: ${trigger.conversationId}`);
      return;
    }

    for (const automation of automations) {
      let triggerRule: AutomationRule;
      try {
        triggerRule = JSON.parse(automation.trigger);
      } catch {
        console.error(`[Automation] Failed to parse trigger for automation ${automation.id}`);
        continue;
      }

      const matches = doesTriggerMatch(triggerRule, trigger);

      if (matches) {
        console.log(`[Automation] Matched automation: ${automation.name} (${automation.id})`);

        let actions: AutomationAction[];
        try {
          actions = JSON.parse(automation.actions);
        } catch {
          console.error(`[Automation] Failed to parse actions for automation ${automation.id}`);
          continue;
        }

        // Execute all actions for this automation
        for (const action of actions) {
          try {
            await executeAction(action, conversation, prisma);
          } catch (err) {
            console.error(
              `[Automation] Failed to execute action ${action.type} for automation ${automation.id}:`,
              err
            );
          }
        }

        // Increment run count
        await prisma.automation.update({
          where: { id: automation.id },
          data: { runCount: { increment: 1 } },
        });
      }
    }
  } catch (err) {
    console.error('[Automation] Error processing automations:', err);
  }
}

/**
 * Check whether an automation's trigger rule matches the incoming trigger event
 */
function doesTriggerMatch(rule: AutomationRule, trigger: AutomationTrigger): boolean {
  if (rule.type !== trigger.type) return false;

  switch (rule.type) {
    case 'keyword':
      if (!rule.value || !trigger.messageContent) return false;
      // Support comma-separated keywords
      const keywords = rule.value.split(',').map((k) => k.trim().toLowerCase());
      const msgLower = trigger.messageContent.toLowerCase();
      return keywords.some((kw) => msgLower.includes(kw));

    case 'new_conversation':
      return true;

    case 'no_reply':
      return true;

    case 'label_added':
      if (!rule.value) return true;
      return rule.value === trigger.value;

    case 'conversation_resolved':
      return true;

    default:
      return false;
  }
}

/**
 * Execute a single automation action on a conversation
 */
export async function executeAction(
  action: AutomationAction,
  conversation: {
    id: string;
    teamId: string;
    contactId: string;
    contact: { phone: string; name?: string | null };
    assignedToId?: string | null;
  },
  db: PrismaClient
): Promise<void> {
  console.log(
    `[Automation] Executing action: ${action.type} with value: ${JSON.stringify(action.value)}`
  );

  switch (action.type) {
    case 'send_message': {
      const messageText = String(action.value || '');
      if (!messageText) break;

      // Send via WhatsApp
      const { messageId, success } = await sendTextMessage(
        conversation.contact.phone,
        messageText,
        conversation.teamId
      );

      // Save the message to DB
      await db.message.create({
        data: {
          conversationId: conversation.id,
          fromType: 'bot',
          type: 'text',
          content: messageText,
          status: success ? 'sent' : 'failed',
          waMessageId: messageId || undefined,
        },
      });

      // Update conversation lastMessageAt
      await db.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: new Date() },
      });

      break;
    }

    case 'send_template': {
      let templateName: string;
      let language = 'en';
      let components: WAMessageComponent[] = [];

      if (typeof action.value === 'string') {
        templateName = action.value;
      } else if (action.value && typeof action.value === 'object') {
        const val = action.value as {
          name?: string;
          language?: string;
          components?: WAMessageComponent[];
        };
        templateName = val.name || '';
        language = val.language || 'en';
        components = val.components || [];
      } else {
        break;
      }

      if (!templateName) break;

      const { messageId, success } = await sendTemplateMessage(
        conversation.contact.phone,
        templateName,
        language,
        components,
        conversation.teamId
      );

      await db.message.create({
        data: {
          conversationId: conversation.id,
          fromType: 'bot',
          type: 'template',
          templateName,
          status: success ? 'sent' : 'failed',
          waMessageId: messageId || undefined,
        },
      });

      await db.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: new Date() },
      });

      break;
    }

    case 'assign_to': {
      const agentId = String(action.value || '');
      if (!agentId) break;

      // Verify agent exists in the team
      const agent = await db.user.findFirst({
        where: { id: agentId, teamId: conversation.teamId },
      });

      if (agent) {
        await db.conversation.update({
          where: { id: conversation.id },
          data: { assignedToId: agentId },
        });

        // Create a system message for the assignment
        await db.message.create({
          data: {
            conversationId: conversation.id,
            fromType: 'system',
            type: 'text',
            content: `Conversation assigned to ${agent.name} by automation`,
            status: 'sent',
          },
        });
      }

      break;
    }

    case 'add_label': {
      const labelId = String(action.value || '');
      if (!labelId) break;

      // Verify label exists in the team
      const label = await db.label.findFirst({
        where: { id: labelId, teamId: conversation.teamId },
      });

      if (label) {
        // Upsert to avoid duplicate
        await db.conversationLabel.upsert({
          where: {
            conversationId_labelId: {
              conversationId: conversation.id,
              labelId,
            },
          },
          create: {
            conversationId: conversation.id,
            labelId,
          },
          update: {},
        });
      }

      break;
    }

    case 'remove_label': {
      const labelId = String(action.value || '');
      if (!labelId) break;

      await db.conversationLabel.deleteMany({
        where: {
          conversationId: conversation.id,
          labelId,
        },
      });

      break;
    }

    case 'resolve': {
      await db.conversation.update({
        where: { id: conversation.id },
        data: { status: 'resolved' },
      });

      await db.message.create({
        data: {
          conversationId: conversation.id,
          fromType: 'system',
          type: 'text',
          content: 'Conversation resolved by automation',
          status: 'sent',
        },
      });

      break;
    }

    case 'reopen': {
      await db.conversation.update({
        where: { id: conversation.id },
        data: { status: 'open' },
      });

      await db.message.create({
        data: {
          conversationId: conversation.id,
          fromType: 'system',
          type: 'text',
          content: 'Conversation reopened by automation',
          status: 'sent',
        },
      });

      break;
    }

    default:
      console.warn(`[Automation] Unknown action type: ${action.type}`);
  }
}
