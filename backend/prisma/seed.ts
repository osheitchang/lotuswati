import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // ─── Clean existing data ──────────────────────────────────────────────────
  await prisma.broadcastContact.deleteMany();
  await prisma.broadcast.deleteMany();
  await prisma.conversationLabel.deleteMany();
  await prisma.note.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.label.deleteMany();
  await prisma.cannedResponse.deleteMany();
  await prisma.automation.deleteMany();
  await prisma.template.deleteMany();
  await prisma.user.deleteMany();
  await prisma.team.deleteMany();

  console.log('🗑  Cleared existing data');

  // ─── Team ─────────────────────────────────────────────────────────────────
  const team = await prisma.team.create({
    data: {
      name: 'Demo Team',
      waPhoneNumberId: '123456789012345',
      waWebhookSecret: 'demo-webhook-secret',
    },
  });

  console.log(`✅ Created team: ${team.name}`);

  // ─── Users ────────────────────────────────────────────────────────────────
  const adminPassword = await bcrypt.hash('demo1234', 12);
  const agentPassword = await bcrypt.hash('demo1234', 12);

  const admin = await prisma.user.create({
    data: {
      email: 'admin@demo.com',
      password: adminPassword,
      name: 'Alice Admin',
      role: 'admin',
      status: 'online',
      teamId: team.id,
    },
  });

  const agent = await prisma.user.create({
    data: {
      email: 'agent@demo.com',
      password: agentPassword,
      name: 'Bob Agent',
      role: 'agent',
      status: 'online',
      teamId: team.id,
    },
  });

  console.log(`✅ Created users: ${admin.email}, ${agent.email}`);

  // ─── Labels ───────────────────────────────────────────────────────────────
  const labelData = [
    { name: 'New Lead', color: '#22c55e' },
    { name: 'Follow Up', color: '#f59e0b' },
    { name: 'VIP', color: '#8b5cf6' },
    { name: 'Support', color: '#3b82f6' },
    { name: 'Sales', color: '#ec4899' },
  ];

  const labels = await Promise.all(
    labelData.map((l) =>
      prisma.label.create({ data: { ...l, teamId: team.id } })
    )
  );

  console.log(`✅ Created ${labels.length} labels`);

  // ─── Contacts ─────────────────────────────────────────────────────────────
  const contactData = [
    { phone: '+14155550101', name: 'Sarah Johnson', email: 'sarah@example.com', tags: ['VIP', 'Sales'] },
    { phone: '+14155550102', name: 'Michael Chen', email: 'mchen@example.com', tags: ['Support'] },
    { phone: '+14155550103', name: 'Emma Williams', email: 'emma.w@example.com', tags: ['New Lead'] },
    { phone: '+14155550104', name: 'James Brown', email: null, tags: ['Follow Up'] },
    { phone: '+14155550105', name: 'Olivia Davis', email: 'olivia@example.com', tags: ['Sales', 'VIP'] },
    { phone: '+14155550106', name: 'William Garcia', email: null, tags: [] },
    { phone: '+14155550107', name: 'Ava Martinez', email: 'ava.m@example.com', tags: ['New Lead'] },
    { phone: '+14155550108', name: 'Noah Wilson', email: null, tags: ['Support'] },
    { phone: '+441234560001', name: 'Liam Thompson', email: 'liam.t@example.co.uk', tags: ['Sales'] },
    { phone: '+441234560002', name: 'Isabella Anderson', email: null, tags: ['VIP'] },
    { phone: '+441234560003', name: 'Mason Taylor', email: 'mason@example.co.uk', tags: ['Follow Up'] },
    { phone: '+441234560004', name: 'Sophia Moore', email: 'sophia@example.co.uk', tags: [] },
    { phone: '+521234560001', name: 'Carlos Ramirez', email: 'carlos.r@example.mx', tags: ['New Lead', 'Sales'] },
    { phone: '+521234560002', name: 'Maria Gonzalez', email: null, tags: ['Support'] },
    { phone: '+521234560003', name: 'Jose Hernandez', email: 'jose.h@example.mx', tags: ['VIP'] },
    { phone: '+521234560004', name: 'Ana Lopez', email: null, tags: ['Follow Up'] },
    { phone: '+61412345001', name: 'Jack Mitchell', email: 'jack@example.com.au', tags: ['Sales'] },
    { phone: '+61412345002', name: 'Grace Carter', email: null, tags: [] },
    { phone: '+49301234001', name: 'Hans Mueller', email: 'hans@example.de', tags: ['New Lead'] },
    { phone: '+33123456001', name: 'Marie Dupont', email: 'marie@example.fr', tags: ['Support'] },
  ];

  const contacts = await Promise.all(
    contactData.map((c) =>
      prisma.contact.create({
        data: {
          phone: c.phone,
          name: c.name,
          email: c.email,
          tags: JSON.stringify(c.tags),
          customFields: JSON.stringify({}),
          teamId: team.id,
        },
      })
    )
  );

  console.log(`✅ Created ${contacts.length} contacts`);

  // ─── Conversations ────────────────────────────────────────────────────────
  const now = new Date();
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 60 * 60 * 1000);
  const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);

  const conversationSeedData = [
    // Open conversations
    { contactIdx: 0, status: 'open', assignedToId: agent.id, lastMessageAt: hoursAgo(0.5), unreadCount: 2 },
    { contactIdx: 1, status: 'open', assignedToId: agent.id, lastMessageAt: hoursAgo(1), unreadCount: 0 },
    { contactIdx: 2, status: 'open', assignedToId: null, lastMessageAt: hoursAgo(2), unreadCount: 5 },
    { contactIdx: 3, status: 'open', assignedToId: admin.id, lastMessageAt: hoursAgo(3), unreadCount: 1 },
    { contactIdx: 4, status: 'open', assignedToId: agent.id, lastMessageAt: hoursAgo(5), unreadCount: 0 },
    { contactIdx: 5, status: 'open', assignedToId: null, lastMessageAt: hoursAgo(8), unreadCount: 3 },
    { contactIdx: 6, status: 'pending', assignedToId: agent.id, lastMessageAt: hoursAgo(12), unreadCount: 0 },
    { contactIdx: 7, status: 'pending', assignedToId: null, lastMessageAt: hoursAgo(24), unreadCount: 0 },
    // Resolved conversations
    { contactIdx: 8, status: 'resolved', assignedToId: agent.id, lastMessageAt: daysAgo(1), unreadCount: 0 },
    { contactIdx: 9, status: 'resolved', assignedToId: admin.id, lastMessageAt: daysAgo(2), unreadCount: 0 },
    { contactIdx: 10, status: 'resolved', assignedToId: agent.id, lastMessageAt: daysAgo(2), unreadCount: 0 },
    { contactIdx: 11, status: 'resolved', assignedToId: agent.id, lastMessageAt: daysAgo(3), unreadCount: 0 },
    { contactIdx: 12, status: 'resolved', assignedToId: admin.id, lastMessageAt: daysAgo(4), unreadCount: 0 },
    { contactIdx: 13, status: 'resolved', assignedToId: agent.id, lastMessageAt: daysAgo(5), unreadCount: 0 },
    { contactIdx: 14, status: 'open', assignedToId: agent.id, lastMessageAt: hoursAgo(6), unreadCount: 1 },
  ];

  const conversations = await Promise.all(
    conversationSeedData.map((c) =>
      prisma.conversation.create({
        data: {
          teamId: team.id,
          contactId: contacts[c.contactIdx].id,
          assignedToId: c.assignedToId,
          status: c.status,
          lastMessageAt: c.lastMessageAt,
          unreadCount: c.unreadCount,
        },
      })
    )
  );

  console.log(`✅ Created ${conversations.length} conversations`);

  // ─── Add labels to some conversations ────────────────────────────────────
  const labelAssignments = [
    { convIdx: 0, labelIdx: 4 },  // Sales
    { convIdx: 0, labelIdx: 2 },  // VIP
    { convIdx: 1, labelIdx: 3 },  // Support
    { convIdx: 2, labelIdx: 0 },  // New Lead
    { convIdx: 3, labelIdx: 1 },  // Follow Up
    { convIdx: 4, labelIdx: 4 },  // Sales
    { convIdx: 6, labelIdx: 3 },  // Support
    { convIdx: 14, labelIdx: 2 }, // VIP
  ];

  await Promise.all(
    labelAssignments.map((a) =>
      prisma.conversationLabel.create({
        data: {
          conversationId: conversations[a.convIdx].id,
          labelId: labels[a.labelIdx].id,
        },
      })
    )
  );

  console.log(`✅ Assigned labels to conversations`);

  // ─── Messages ─────────────────────────────────────────────────────────────
  type MessageInput = {
    conversationIdx: number;
    fromType: string;
    fromId?: string;
    content: string;
    type?: string;
    status?: string;
    minutesAgo: number;
  };

  const messageSeedData: MessageInput[] = [
    // Conversation 0 - Sarah Johnson (open, VIP Sales)
    { conversationIdx: 0, fromType: 'contact', content: 'Hi! I\'m interested in your premium plan', type: 'text', status: 'delivered', minutesAgo: 90 },
    { conversationIdx: 0, fromType: 'agent', fromId: agent.id, content: 'Hello Sarah! Great to hear from you. I\'d love to tell you about our premium options.', type: 'text', status: 'read', minutesAgo: 85 },
    { conversationIdx: 0, fromType: 'contact', content: 'What are the pricing tiers?', type: 'text', status: 'delivered', minutesAgo: 80 },
    { conversationIdx: 0, fromType: 'agent', fromId: agent.id, content: 'We have three tiers: Starter ($29/mo), Professional ($79/mo), and Enterprise (custom pricing). Which best fits your needs?', type: 'text', status: 'read', minutesAgo: 78 },
    { conversationIdx: 0, fromType: 'contact', content: 'The Professional plan sounds good. Can we schedule a demo?', type: 'text', status: 'delivered', minutesAgo: 30 },
    { conversationIdx: 0, fromType: 'contact', content: 'Also, do you offer annual billing discounts?', type: 'text', status: 'delivered', minutesAgo: 28 },

    // Conversation 1 - Michael Chen (open, Support)
    { conversationIdx: 1, fromType: 'contact', content: 'I\'m having trouble logging into my account', type: 'text', status: 'delivered', minutesAgo: 120 },
    { conversationIdx: 1, fromType: 'agent', fromId: agent.id, content: 'Hi Michael! I\'m sorry to hear that. Let\'s get this sorted. Can you tell me the email address you use to log in?', type: 'text', status: 'read', minutesAgo: 115 },
    { conversationIdx: 1, fromType: 'contact', content: 'mchen@example.com', type: 'text', status: 'delivered', minutesAgo: 113 },
    { conversationIdx: 1, fromType: 'agent', fromId: agent.id, content: 'Thank you! I\'ve sent a password reset link to that email. Please check your inbox and spam folder.', type: 'text', status: 'read', minutesAgo: 110 },
    { conversationIdx: 1, fromType: 'contact', content: 'Got it, thanks! The reset worked.', type: 'text', status: 'read', minutesAgo: 62 },
    { conversationIdx: 1, fromType: 'agent', fromId: agent.id, content: 'Great! Is there anything else I can help you with?', type: 'text', status: 'read', minutesAgo: 60 },

    // Conversation 2 - Emma Williams (open, New Lead, unread)
    { conversationIdx: 2, fromType: 'contact', content: 'Hello, I found you through Google. What services do you offer?', type: 'text', status: 'delivered', minutesAgo: 130 },
    { conversationIdx: 2, fromType: 'contact', content: 'I run a small e-commerce business', type: 'text', status: 'delivered', minutesAgo: 125 },
    { conversationIdx: 2, fromType: 'contact', content: 'We process about 500 orders per month', type: 'text', status: 'delivered', minutesAgo: 124 },
    { conversationIdx: 2, fromType: 'contact', content: 'Do you have a trial period?', type: 'text', status: 'delivered', minutesAgo: 120 },
    { conversationIdx: 2, fromType: 'contact', content: 'Looking forward to hearing from you!', type: 'text', status: 'delivered', minutesAgo: 119 },

    // Conversation 3 - James Brown (open, Follow Up)
    { conversationIdx: 3, fromType: 'contact', content: 'Following up on my quote request from last week', type: 'text', status: 'delivered', minutesAgo: 200 },
    { conversationIdx: 3, fromType: 'agent', fromId: admin.id, content: 'Hi James! Apologies for the delay. Let me pull up your quote details.', type: 'text', status: 'read', minutesAgo: 195 },
    { conversationIdx: 3, fromType: 'agent', fromId: admin.id, content: 'I\'ve prepared a custom quote for you. Can I send it to your email?', type: 'text', status: 'read', minutesAgo: 190 },
    { conversationIdx: 3, fromType: 'contact', content: 'Yes please! james.brown@company.com', type: 'text', status: 'delivered', minutesAgo: 185 },

    // Conversation 4 - Olivia Davis (open, Sales)
    { conversationIdx: 4, fromType: 'contact', content: 'Hi, I\'d like to upgrade my current plan', type: 'text', status: 'delivered', minutesAgo: 320 },
    { conversationIdx: 4, fromType: 'agent', fromId: agent.id, content: 'Hi Olivia! Happy to help with that. You\'re currently on the Starter plan. Would you like to upgrade to Professional?', type: 'text', status: 'read', minutesAgo: 315 },
    { conversationIdx: 4, fromType: 'contact', content: 'Yes, that\'s right. What features does it include?', type: 'text', status: 'delivered', minutesAgo: 310 },
    { conversationIdx: 4, fromType: 'agent', fromId: agent.id, content: 'The Professional plan includes: unlimited conversations, 5 agents, advanced analytics, automations, and priority support. Shall I process the upgrade?', type: 'text', status: 'read', minutesAgo: 305 },
    { conversationIdx: 4, fromType: 'contact', content: 'Perfect, let\'s do it!', type: 'text', status: 'read', minutesAgo: 300 },

    // Conversation 5 - William Garcia (open, unread)
    { conversationIdx: 5, fromType: 'contact', content: 'Hey, I have a billing question', type: 'text', status: 'delivered', minutesAgo: 500 },
    { conversationIdx: 5, fromType: 'contact', content: 'I was charged twice this month', type: 'text', status: 'delivered', minutesAgo: 499 },
    { conversationIdx: 5, fromType: 'contact', content: 'Please help ASAP', type: 'text', status: 'delivered', minutesAgo: 498 },

    // Conversation 6 - Ava Martinez (pending)
    { conversationIdx: 6, fromType: 'contact', content: 'I need help setting up my WhatsApp integration', type: 'text', status: 'delivered', minutesAgo: 800 },
    { conversationIdx: 6, fromType: 'agent', fromId: agent.id, content: 'Hi Ava! I\'d be happy to help. Are you setting up for the first time or migrating from another platform?', type: 'text', status: 'read', minutesAgo: 795 },
    { conversationIdx: 6, fromType: 'contact', content: 'First time setup', type: 'text', status: 'delivered', minutesAgo: 790 },
    { conversationIdx: 6, fromType: 'agent', fromId: agent.id, content: 'Great! I\'ll send you our setup guide. Please follow steps 1-3 and let me know if you get stuck.', type: 'text', status: 'read', minutesAgo: 785 },

    // Conversation 8 - Liam Thompson (resolved)
    { conversationIdx: 8, fromType: 'contact', content: 'Can I add more agents to my account?', type: 'text', status: 'read', minutesAgo: 1440 },
    { conversationIdx: 8, fromType: 'agent', fromId: agent.id, content: 'Hi Liam! Yes, you can add up to 10 agents on the Professional plan. Go to Settings > Team > Invite Agent.', type: 'text', status: 'read', minutesAgo: 1430 },
    { conversationIdx: 8, fromType: 'contact', content: 'Got it, thanks!', type: 'text', status: 'read', minutesAgo: 1420 },
    { conversationIdx: 8, fromType: 'system', content: 'Conversation resolved by agent@demo.com', type: 'text', status: 'sent', minutesAgo: 1415 },

    // Conversation 9 - Isabella Anderson (resolved)
    { conversationIdx: 9, fromType: 'contact', content: 'I want to cancel my subscription', type: 'text', status: 'read', minutesAgo: 2880 },
    { conversationIdx: 9, fromType: 'agent', fromId: admin.id, content: 'Hi Isabella, I\'m sorry to hear that. Can I ask what\'s prompting you to cancel?', type: 'text', status: 'read', minutesAgo: 2870 },
    { conversationIdx: 9, fromType: 'contact', content: 'I\'m not using it enough to justify the cost', type: 'text', status: 'read', minutesAgo: 2860 },
    { conversationIdx: 9, fromType: 'agent', fromId: admin.id, content: 'I understand. How about we downgrade you to our free tier instead? You\'ll keep your data and can upgrade anytime.', type: 'text', status: 'read', minutesAgo: 2855 },
    { conversationIdx: 9, fromType: 'contact', content: 'That works, thank you!', type: 'text', status: 'read', minutesAgo: 2850 },
    { conversationIdx: 9, fromType: 'system', content: 'Conversation resolved by admin@demo.com', type: 'text', status: 'sent', minutesAgo: 2845 },

    // Conversation 14 - Jose Hernandez (open, VIP)
    { conversationIdx: 14, fromType: 'contact', content: 'Buenos días, necesito soporte técnico', type: 'text', status: 'delivered', minutesAgo: 360 },
    { conversationIdx: 14, fromType: 'agent', fromId: agent.id, content: 'Buenos días! Con gusto le ayudamos. ¿Cuál es el problema que está experimentando?', type: 'text', status: 'read', minutesAgo: 355 },
    { conversationIdx: 14, fromType: 'contact', content: 'No puedo enviar mensajes masivos', type: 'text', status: 'delivered', minutesAgo: 350 },
  ];

  for (const msg of messageSeedData) {
    const msgTime = new Date(now.getTime() - msg.minutesAgo * 60 * 1000);
    await prisma.message.create({
      data: {
        conversationId: conversations[msg.conversationIdx].id,
        fromType: msg.fromType,
        fromId: msg.fromId || null,
        type: msg.type || 'text',
        content: msg.content,
        status: msg.status || 'sent',
        waMessageId: msg.fromType === 'contact' ? `wamid.mock_${Date.now()}_${Math.random().toString(36).slice(2)}` : undefined,
        metadata: '{}',
        createdAt: msgTime,
      },
    });
  }

  console.log(`✅ Created ${messageSeedData.length} messages`);

  // ─── Notes ────────────────────────────────────────────────────────────────
  await prisma.note.create({
    data: {
      conversationId: conversations[0].id,
      userId: admin.id,
      content: 'High priority - VIP customer. Mentioned she\'s also evaluating Competitor X.',
      createdAt: hoursAgo(1),
    },
  });

  await prisma.note.create({
    data: {
      conversationId: conversations[3].id,
      userId: admin.id,
      content: 'Customer was referred by partner agency. Offer 10% referral discount.',
      createdAt: hoursAgo(3),
    },
  });

  console.log(`✅ Created notes`);

  // ─── Templates ────────────────────────────────────────────────────────────
  const templateSeedData = [
    {
      name: 'welcome_message',
      category: 'UTILITY',
      language: 'en',
      status: 'approved',
      body: 'Hi {{1}}, welcome to {{2}}! We\'re excited to have you. Your account is now active. Reply with any questions.',
      footer: 'Reply STOP to unsubscribe',
      buttons: [],
      waTemplateId: 'wa_tmpl_001',
    },
    {
      name: 'order_confirmation',
      category: 'UTILITY',
      language: 'en',
      status: 'approved',
      headerType: 'TEXT',
      headerValue: 'Order Confirmed ✓',
      body: 'Hi {{1}}, your order #{{2}} has been confirmed! Estimated delivery: {{3}}. Track your order at: {{4}}',
      footer: 'Thank you for your purchase',
      buttons: [
        { type: 'URL', text: 'Track Order', url: 'https://example.com/track/{{1}}' },
      ],
      waTemplateId: 'wa_tmpl_002',
    },
    {
      name: 'appointment_reminder',
      category: 'UTILITY',
      language: 'en',
      status: 'approved',
      body: 'Reminder: You have an appointment scheduled for {{1}} at {{2}}. Reply YES to confirm or NO to cancel.',
      buttons: [
        { type: 'QUICK_REPLY', text: 'Confirm' },
        { type: 'QUICK_REPLY', text: 'Cancel' },
      ],
      waTemplateId: 'wa_tmpl_003',
    },
    {
      name: 'promotional_offer',
      category: 'MARKETING',
      language: 'en',
      status: 'approved',
      headerType: 'TEXT',
      headerValue: '🎉 Special Offer Just for You!',
      body: 'Hi {{1}}, we have an exclusive {{2}}% discount on all plans this week only! Use code {{3}} at checkout. Valid until {{4}}.',
      footer: 'Reply STOP to opt out',
      buttons: [
        { type: 'URL', text: 'Claim Offer', url: 'https://example.com/offer' },
      ],
      waTemplateId: 'wa_tmpl_004',
    },
    {
      name: 'support_ticket_created',
      category: 'UTILITY',
      language: 'en',
      status: 'approved',
      body: 'Hi {{1}}, your support ticket #{{2}} has been created. Our team will respond within {{3}} hours. We appreciate your patience.',
      buttons: [],
      waTemplateId: 'wa_tmpl_005',
    },
  ];

  const templates = await Promise.all(
    templateSeedData.map((t) =>
      prisma.template.create({
        data: {
          ...t,
          buttons: JSON.stringify(t.buttons || []),
          teamId: team.id,
        },
      })
    )
  );

  console.log(`✅ Created ${templates.length} templates`);

  // ─── Automations ──────────────────────────────────────────────────────────
  const automationSeedData = [
    {
      name: 'Welcome New Conversations',
      isActive: true,
      trigger: JSON.stringify({ type: 'new_conversation' }),
      actions: JSON.stringify([
        {
          type: 'send_message',
          value: 'Hi there! 👋 Thanks for reaching out to Demo Team. We typically respond within a few minutes during business hours. How can we help you today?',
        },
      ]),
      runCount: 47,
    },
    {
      name: 'Keyword: Pricing',
      isActive: true,
      trigger: JSON.stringify({ type: 'keyword', value: 'pricing,price,cost,how much,plans' }),
      actions: JSON.stringify([
        {
          type: 'send_message',
          value: 'Thanks for your interest in our pricing! 💰 We have three plans:\n\n• Starter: $29/mo (1 agent)\n• Professional: $79/mo (5 agents)\n• Enterprise: Custom pricing\n\nAll plans include a 14-day free trial. Would you like more details about any specific plan?',
        },
        {
          type: 'add_label',
          value: null, // Would be set to sales label ID in production
        },
      ]),
      runCount: 23,
    },
    {
      name: 'Auto-assign Support Tickets',
      isActive: false,
      trigger: JSON.stringify({ type: 'keyword', value: 'help,support,issue,problem,bug,error' }),
      actions: JSON.stringify([
        {
          type: 'assign_to',
          value: agent.id,
        },
        {
          type: 'send_message',
          value: 'I\'ve connected you with our support team. They\'ll be with you shortly! 🛠️',
        },
      ]),
      runCount: 89,
    },
  ];

  const automations = await Promise.all(
    automationSeedData.map((a) =>
      prisma.automation.create({
        data: { ...a, teamId: team.id },
      })
    )
  );

  console.log(`✅ Created ${automations.length} automations`);

  // ─── Canned Responses ─────────────────────────────────────────────────────
  const cannedResponseData = [
    {
      shortcut: 'greeting',
      content: 'Hi there! 👋 Welcome to Demo Team. How can I help you today?',
    },
    {
      shortcut: 'thanks',
      content: 'Thank you for reaching out! Is there anything else I can help you with?',
    },
    {
      shortcut: 'sorry',
      content: 'I apologize for the inconvenience. Let me look into this right away and get back to you as soon as possible.',
    },
    {
      shortcut: 'callback',
      content: 'I\'d be happy to arrange a callback for you! Please let me know your preferred time and phone number.',
    },
    {
      shortcut: 'hours',
      content: 'Our business hours are Monday to Friday, 9AM to 6PM (EST). We\'ll respond to messages outside these hours on the next business day.',
    },
    {
      shortcut: 'pricing',
      content: 'Our plans start at $29/month. You can view full pricing details at https://example.com/pricing. We also offer a 14-day free trial on all plans!',
    },
    {
      shortcut: 'trial',
      content: 'Yes! All our plans come with a 14-day free trial, no credit card required. To get started, visit https://example.com/signup',
    },
    {
      shortcut: 'escalate',
      content: 'I\'m going to escalate this to our specialist team who can better assist you. You\'ll hear from them within 2 business hours.',
    },
    {
      shortcut: 'resolved',
      content: 'Great! I\'m glad we could resolve this for you. If you ever need help again, don\'t hesitate to reach out. Have a wonderful day! 😊',
    },
    {
      shortcut: 'follow_up',
      content: 'I wanted to follow up on our previous conversation. Have you had a chance to try the solution we discussed? Please let me know if you need any further assistance.',
    },
  ];

  const cannedResponses = await Promise.all(
    cannedResponseData.map((cr) =>
      prisma.cannedResponse.create({
        data: { ...cr, teamId: team.id },
      })
    )
  );

  console.log(`✅ Created ${cannedResponses.length} canned responses`);

  // ─── Sample Broadcast ─────────────────────────────────────────────────────
  const broadcast = await prisma.broadcast.create({
    data: {
      name: 'Q1 Promotional Campaign',
      templateId: templates[3].id, // promotional_offer
      teamId: team.id,
      status: 'completed',
      startedAt: daysAgo(3),
      completedAt: daysAgo(3),
      totalCount: 15,
      sentCount: 14,
      deliveredCount: 13,
      failedCount: 1,
    },
  });

  // Add broadcast contacts
  await Promise.all(
    contacts.slice(0, 15).map((c, idx) =>
      prisma.broadcastContact.create({
        data: {
          broadcastId: broadcast.id,
          contactId: c.id,
          status: idx === 7 ? 'failed' : idx < 13 ? 'delivered' : 'sent',
          sentAt: idx === 7 ? undefined : daysAgo(3),
          error: idx === 7 ? 'Number not registered on WhatsApp' : undefined,
        },
      })
    )
  );

  console.log(`✅ Created sample broadcast`);

  // ─── Summary ──────────────────────────────────────────────────────────────
  console.log('\n✨ Seed complete!\n');
  console.log('─────────────────────────────────────');
  console.log('Demo Credentials:');
  console.log('  Admin: admin@demo.com / demo1234');
  console.log('  Agent: agent@demo.com / demo1234');
  console.log('─────────────────────────────────────');
  console.log(`Team ID: ${team.id}`);
  console.log(`Contacts: ${contacts.length}`);
  console.log(`Conversations: ${conversations.length}`);
  console.log(`Messages: ${messageSeedData.length}`);
  console.log(`Templates: ${templates.length}`);
  console.log(`Automations: ${automations.length}`);
  console.log(`Labels: ${labels.length}`);
  console.log(`Canned Responses: ${cannedResponses.length}`);
  console.log('─────────────────────────────────────\n');
}

main()
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
