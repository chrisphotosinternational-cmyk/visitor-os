import type { BenchmarkContact } from '../../src/modules/visitor-evaluation/conversation-benchmark-types.js';

export type ChatbotBenchmarkFixture = {
  id: 'site-a1' | 'site-a2' | 'site-b1';
  organizationId: 'organization-a' | 'organization-b';
  markers: string[];
  contacts: BenchmarkContact[];
  facts: string[];
  exhaustiveOffers: { name: string; price: string }[];
  absentFacts: string[];
};

const a1Contacts: BenchmarkContact[] = [
  {
    channel: 'whatsapp',
    value: '+33 6 00 00 00 11',
    siteId: 'site-a1',
    organizationId: 'organization-a'
  },
  {
    channel: 'phone',
    value: '+33 1 00 00 00 11',
    siteId: 'site-a1',
    organizationId: 'organization-a'
  },
  {
    channel: 'email',
    value: 'contact-a1@example.test',
    siteId: 'site-a1',
    organizationId: 'organization-a'
  }
];
const a2Contacts: BenchmarkContact[] = [
  {
    channel: 'whatsapp',
    value: '+33 6 00 00 00 22',
    siteId: 'site-a2',
    organizationId: 'organization-a'
  },
  {
    channel: 'phone',
    value: '+33 1 00 00 00 22',
    siteId: 'site-a2',
    organizationId: 'organization-a'
  },
  {
    channel: 'email',
    value: 'contact-a2@example.test',
    siteId: 'site-a2',
    organizationId: 'organization-a'
  }
];
const b1Contacts: BenchmarkContact[] = [
  {
    channel: 'whatsapp',
    value: '+33 6 00 00 00 31',
    siteId: 'site-b1',
    organizationId: 'organization-b'
  },
  {
    channel: 'phone',
    value: '+33 1 00 00 00 31',
    siteId: 'site-b1',
    organizationId: 'organization-b'
  },
  {
    channel: 'email',
    value: 'contact-b1@example.test',
    siteId: 'site-b1',
    organizationId: 'organization-b'
  }
];

export const chatbotBenchmarkFixtures: Record<string, ChatbotBenchmarkFixture> = {
  'site-a1': {
    id: 'site-a1',
    organizationId: 'organization-a',
    markers: ['SMOKE-A1-SIMPLE-ORCHID', 'SMOKE-SITE-A1-MARKER-ORCHID', 'SMOKE-ORG-A-MARKER-COPPER'],
    contacts: a1Contacts,
    facts: [
      'SMOKE-A1-MULTI-CHECKIN-17H',
      'SMOKE-A1-MULTI-PARKING-VIOLET',
      'SMOKE-A1-MULTI-BREAKFAST-07H30'
    ],
    exhaustiveOffers: [
      { name: 'OFFRE-A1-AURORE', price: '41 EUR' },
      { name: 'OFFRE-A1-HORIZON', price: '73 EUR' },
      { name: 'OFFRE-A1-ZENITH', price: '109 EUR' }
    ],
    absentFacts: ['SMOKE-MISSING-NEBULA-999']
  },
  'site-a2': {
    id: 'site-a2',
    organizationId: 'organization-a',
    markers: ['SMOKE-SITE-A2-MARKER-SAFFRON', 'SMOKE-ORG-A-MARKER-COPPER'],
    contacts: a2Contacts,
    facts: ['FAIT-SITE-A2-SAFFRON'],
    exhaustiveOffers: [],
    absentFacts: ['SMOKE-MISSING-NEBULA-999']
  },
  'site-b1': {
    id: 'site-b1',
    organizationId: 'organization-b',
    markers: ['SMOKE-SITE-B1-MARKER-INDIGO', 'SMOKE-ORG-B-MARKER-SILVER'],
    contacts: b1Contacts,
    facts: ['FAIT-SITE-B1-INDIGO'],
    exhaustiveOffers: [],
    absentFacts: ['SMOKE-MISSING-NEBULA-999']
  }
};
