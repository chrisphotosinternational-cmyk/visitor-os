import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { toCsv, toSpreadsheetXml } from '../src/modules/crm/csv-export.js';
import { calculateLeadScore } from '../src/modules/crm/lead-scoring.js';
import { statusFromScore } from '../src/modules/crm/crm-repository.js';
import { detectAutomaticTags } from '../src/modules/crm/tags.js';

describe('advanced CRM', () => {
  it('calculates and explains a hot lead score', () => {
    const result = calculateLeadScore({
      email: 'client@example.com',
      phone: '+33123456789',
      messages: [
        'Bonjour, je voudrais connaitre le tarif et reserver demain rapidement pour un week-end.'
      ],
      previousConversationCount: 1
    });

    assert.equal(result.score, 100);
    assert.equal(result.temperature, 'chaude');
    assert.ok(result.reasons.some((reason) => reason.code === 'email'));
    assert.ok(result.reasons.some((reason) => reason.code === 'booking_request'));
    assert.ok(result.reasons.some((reason) => reason.code === 'returning_visitor'));
  });

  it('maps score to CRM status', () => {
    assert.equal(statusFromScore(84), 'Reservation probable');
    assert.equal(statusFromScore(72), 'Interesse');
    assert.equal(statusFromScore(58), 'A qualifier');
    assert.equal(statusFromScore(25), 'Nouveau');
  });

  it('detects automatic tags from visitor intent', () => {
    const tags = detectAutomaticTags([
      'Avez-vous un parking et un petit-dejeuner pour un shooting photo urgent ?'
    ]).map((tag) => tag.slug);

    assert.ok(tags.includes('parking'));
    assert.ok(tags.includes('petit-dejeuner'));
    assert.ok(tags.includes('shooting-photo'));
    assert.ok(tags.includes('urgent'));
  });

  it('falls back to Autre tag when no keyword matches', () => {
    const tags = detectAutomaticTags(['Question generale sans mot cle']).map((tag) => tag.slug);

    assert.deepEqual(tags, ['autre']);
  });

  it('exports CRM rows to CSV and spreadsheet XML', () => {
    const rows = [
      {
        Date: '2026-07-01',
        Organisation: 'Demo',
        Site: 'Site demo',
        Prenom: 'Chris',
        Nom: 'Demo',
        Email: 'client@example.com',
        Telephone: '+33123456789',
        Statut: 'Interesse',
        Score: 72,
        Tags: 'Tarif',
        Source: 'widget'
      }
    ];

    assert.match(toCsv(rows), /"Email"/);
    assert.match(toCsv(rows), /"client@example.com"/);
    assert.match(toSpreadsheetXml(rows), /<Workbook/);
  });
});
