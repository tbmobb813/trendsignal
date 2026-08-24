import { describe, it, expect } from 'vitest';
import { analyzeFormatFit } from './format-fit';
import { evaluateAutomationFeasibility } from './automation';
import { evaluateAdvertiserSafety } from './advertiser-safety';

describe('Format Fit Analyzer', () => {
  it('returns HYBRID when video list is empty', () => {
    const res = analyzeFormatFit([]);
    expect(res.type).toBe('HYBRID');
  });

  it('detects SHORTS_DOMINANT when over 40% of titles contain shorts tags', () => {
    const mockVideos = [
      { id: '1', title: 'Quick Pottery Hack #shorts' },
      { id: '2', title: 'Spinning Clay #shorts' },
      { id: '3', title: 'Pottery Tutorial Full' },
      { id: '4', title: 'Ceramics #Short' },
      { id: '5', title: 'Glazing Guide' },
    ];
    const res = analyzeFormatFit(mockVideos);
    expect(res.type).toBe('SHORTS_DOMINANT');
    expect(res.shortsShare).toBe(60);
  });

  it('detects LONG_FORM_FAVORED when shorts share is under 15%', () => {
    const mockVideos = [
      { id: '1', title: 'Japanese Chisel Sharpening Masterclass' },
      { id: '2', title: 'Restoring a 100 Year Old Plane' },
      { id: '3', title: 'Woodworking Tools Guide' },
    ];
    const res = analyzeFormatFit(mockVideos);
    expect(res.type).toBe('LONG_FORM_FAVORED');
    expect(res.longFormShare).toBe(100);
  });
});

describe('Faceless Automation Feasibility Engine', () => {
  it('scores tech & coding queries as HIGH automation potential', () => {
    const res = evaluateAutomationFeasibility('python programming tutorial');
    expect(res.tier).toBe('HIGH');
    expect(res.score).toBe(90);
  });

  it('scores vlogs & routines as LOW automation potential', () => {
    const res = evaluateAutomationFeasibility('morning routine vlog');
    expect(res.tier).toBe('LOW');
    expect(res.score).toBe(30);
  });

  it('scores cooking & DIY as MEDIUM automation potential', () => {
    const res = evaluateAutomationFeasibility('woodworking workbench diy');
    expect(res.tier).toBe('MEDIUM');
    expect(res.score).toBe(65);
  });
});

describe('Advertiser Safety Guard', () => {
  it('identifies restricted gambling queries as RESTRICTED', () => {
    const res = evaluateAdvertiserSafety('casino betting strategies');
    expect(res.status).toBe('RESTRICTED');
    expect(res.score).toBe(30);
  });

  it('identifies crypto queries as CAUTION', () => {
    const res = evaluateAdvertiserSafety('crypto trading 2026');
    expect(res.status).toBe('CAUTION');
    expect(res.score).toBe(70);
  });

  it('identifies clean queries as SAFE', () => {
    const res = evaluateAdvertiserSafety('pottery for beginners');
    expect(res.status).toBe('SAFE');
    expect(res.score).toBe(98);
  });
});
