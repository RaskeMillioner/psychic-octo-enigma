import assert from 'node:assert/strict';
import { test } from 'node:test';
import { toReceipt, type ReceiptLineReading, type ReceiptReading } from '../receiptFields.ts';

const line = (over: Partial<ReceiptLineReading> = {}): ReceiptLineReading => ({
  lineText: 'CH MARGAUX 15 x2',
  producer: 'Château Margaux',
  name: '',
  vintage: '2015',
  quantity: '2',
  unitPrice: '650',
  sizeMl: '750',
  country: 'France',
  region: 'Bordeaux',
  appellation: 'Margaux',
  grapes: ['Cabernet Sauvignon'],
  wineType: 'Red',
  confidence: 'high',
  ...over,
});

const receipt = (over: Partial<ReceiptReading> = {}): ReceiptReading => ({
  isReceipt: true,
  merchant: 'Vinmonopolet',
  purchaseDate: '2026-08-01',
  currency: 'nok',
  notes: '',
  lines: [line()],
  ...over,
});

test('a read receipt becomes bottles the cellar can take', () => {
  const parsed = toReceipt(receipt());
  assert.equal(parsed.merchant, 'Vinmonopolet');
  assert.equal(parsed.purchaseDate, '2026-08-01');
  assert.equal(parsed.currency, 'NOK', 'the code is normalised to upper case');
  assert.deepEqual(parsed.lines[0], {
    lineText: 'CH MARGAUX 15 x2',
    producer: 'Château Margaux',
    name: '',
    vintage: 2015,
    quantity: 2,
    unitPrice: 650,
    sizeMl: 750,
    country: 'France',
    region: 'Bordeaux',
    appellation: 'Margaux',
    grapes: ['Cabernet Sauvignon'],
    wineType: 'Red',
    confidence: 'high',
  });
});

test('prices are read whichever way the receipt writes them', () => {
  const price = (unitPrice: string) => toReceipt(receipt({ lines: [line({ unitPrice })] })).lines[0].unitPrice;
  assert.equal(price('1 245,50'), 1245.5, 'space grouping, comma decimal');
  assert.equal(price('1,245.50'), 1245.5, 'comma grouping, dot decimal');
  assert.equal(price('kr 249,90'), 249.9, 'a currency symbol on the line');
  assert.equal(price('42'), 42);
  assert.equal(price(''), null, 'no price printed is not a price of zero');
  assert.equal(price('—'), null);
});

test('a line the model could not count is still one bottle', () => {
  const quantity = (value: string) => toReceipt(receipt({ lines: [line({ quantity: value })] })).lines[0].quantity;
  assert.equal(quantity(''), 1);
  assert.equal(quantity('0'), 1, 'nobody buys zero bottles');
  assert.equal(quantity('12'), 12);
  assert.equal(quantity('6 stk'), 6);
});

test('unreadable values fall back rather than inventing', () => {
  const [only] = toReceipt(
    receipt({
      purchaseDate: '01/08/26',
      currency: '',
      lines: [line({ vintage: 'NV', sizeMl: '', wineType: 'Sparkling-ish', confidence: '' })],
    }),
  ).lines;
  assert.equal(only.vintage, null, 'NV is not a year');
  assert.equal(only.sizeMl, 750, 'a bottle unless the line says otherwise');
  assert.equal(only.wineType, '', 'an unknown style is left for the user');
  assert.equal(only.confidence, 'low', 'and an unstated confidence is not high');
  const parsed = toReceipt(receipt({ purchaseDate: '01/08/26' }));
  assert.equal(parsed.purchaseDate, '', 'a date that is not ISO is no date at all');
});

test('a photo that is not a receipt says so', () => {
  const parsed = toReceipt(receipt({ isReceipt: false, lines: [] }));
  assert.equal(parsed.isReceipt, false);
  assert.deepEqual(parsed.lines, []);
});
