import { describe, it, expect } from 'vitest';
import {
  classifyCell,
  describeCell,
  classifyBmiCategoryCell,
  describeBmiCategoryCell,
  isBmiCol,
  isBmiCategoryCol,
  isProvenanceCol,
} from './cellFlags';

describe('isBmiCol / isBmiCategoryCol', () => {
  it('matches the numeric BMI column', () => {
    expect(isBmiCol('BMI')).toBe(true);
  });
  it('excludes the category column from isBmiCol', () => {
    expect(isBmiCol('BMI_Category')).toBe(false);
  });
  it('matches the category column with isBmiCategoryCol', () => {
    expect(isBmiCategoryCol('BMI_Category_EN')).toBe(true);
    expect(isBmiCategoryCol('Kategori_BMI')).toBe(true);
  });
  it('does not treat the numeric BMI column as a category', () => {
    expect(isBmiCategoryCol('BMI')).toBe(false);
  });
});

describe('classifyBmiCategoryCell — mirrors the row BMI flag', () => {
  it('flags a category derived from an impossibly-low BMI', () => {
    expect(classifyBmiCategoryCell({ BMI: 3.25 })).toBe('warn');
  });
  it('passes a category derived from an in-band BMI', () => {
    expect(classifyBmiCategoryCell({ BMI: 15 })).toBe('ok');
  });
  it('flags a category derived from an obese-range BMI', () => {
    expect(classifyBmiCategoryCell({ BMI: 19 })).toBe('warn');
  });
  it('returns ok when there is no BMI to mirror', () => {
    expect(classifyBmiCategoryCell({})).toBe('ok');
  });
  it('returns ok when the BMI is not a number', () => {
    expect(classifyBmiCategoryCell({ BMI: 'nan' })).toBe('ok');
  });
});

describe('describeBmiCategoryCell', () => {
  it('explains an out-of-band category', () => {
    const r = describeBmiCategoryCell({ BMI: 3.25 });
    expect(r).not.toBeNull();
    expect(r?.flag).toBe('warn');
    expect(r?.detailEN).toContain('3.25');
  });
  it('returns null for an in-band category', () => {
    expect(describeBmiCategoryCell({ BMI: 15 })).toBeNull();
  });
});

describe('regression — category text is not flagged as Not-a-number', () => {
  it('classifyCell leaves a BMI_Category text value ok', () => {
    expect(classifyCell('BMI_Category', 'Kurus')).toBe('ok');
  });
});

describe('isProvenanceCol — engine status columns', () => {
  it('matches exclude_reason and review_reason', () => {
    expect(isProvenanceCol('exclude_reason')).toBe(true);
    expect(isProvenanceCol('review_reason')).toBe(true);
  });
  it('matches any *_reason column and _-prefixed internal columns', () => {
    expect(isProvenanceCol('drop_reason')).toBe(true);
    expect(isProvenanceCol('_exclude_label')).toBe(true);
  });
  it('does not match measurement columns', () => {
    expect(isProvenanceCol('Berat_kg')).toBe(false);
    expect(isProvenanceCol('Tarikh_Lahir')).toBe(false);
  });
});

describe('provenance columns are never flagged as missing values', () => {
  it('classifyCell returns ok for an empty exclude_reason (row was kept)', () => {
    expect(classifyCell('exclude_reason', '')).toBe('ok');
    expect(classifyCell('exclude_reason', null)).toBe('ok');
  });
  it('classifyCell returns ok for an empty review_reason (no review needed)', () => {
    expect(classifyCell('review_reason', '')).toBe('ok');
  });
  it('classifyCell leaves a filled review_reason ok (plain text, not an anomaly)', () => {
    expect(classifyCell('review_reason', 'review_facility_unknown')).toBe('ok');
  });
  it('describeCell returns no tooltip for an empty provenance cell', () => {
    expect(describeCell('exclude_reason', '')).toBeNull();
    expect(describeCell('review_reason', null)).toBeNull();
  });
});
