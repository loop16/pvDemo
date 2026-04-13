'use client';

import { useState, useEffect } from 'react';

const MONO = "'SF Mono', 'JetBrains Mono', 'Fira Code', ui-monospace, monospace";

type Step = {
  title: string;
  body: string[];
};

const SHARED_STEPS: Step[] = [
  {
    title: 'Welcome to Pricevault',
    body: [
      'Pricevault gives you statistically-derived stop levels across 1,200+ assets — stocks, crypto, FX, and futures.',
      'New levels are set up every quarter based on the historical distribution.',
      'Your exit should be backed by data, not a feeling.',
    ],
  },
  {
    title: 'Reading the Chart',
    body: [
      'The colored boxes on the chart are probability zones built from the quarterly range midpoint.',
      'Blue boxes sit above the midpoint. Purple boxes sit below.',
      'The number on each level is the probability you will get stopped out there — 80% means 8 in 10 quarters reached that level, 20% means only 2 in 10 did.',
      'The red dashed line marks the quarter midpoint itself.',
    ],
  },
  {
    title: 'Models',
    body: [
      'Pro — Uses four scenarios (strong/weak × long/short) based on the price action during the quarter. The active scenario is auto-detected and can change as price develops.',
      'Simple — Directional levels without scenario distinction. Shows individual lines instead of probability boxes.',
      'Beta — Scales another asset\'s Pro levels by the volatility ratio. Great for individual stocks and instruments with limited history.',
    ],
  },
];

const TERMINAL_STEPS: Step[] = [
  ...SHARED_STEPS,
  {
    title: 'Stats Dashboard',
    body: [
      'The Stats tab shows every asset\'s current position relative to its probability zones — filterable by asset class, direction, and model.',
      'See where each asset\'s quarter high, quarter low, and previous quarter close landed within the distribution.',
      'Click any ticker to load it directly into your active chart panel.',
    ],
  },
  {
    title: 'Getting Started',
    body: [
      'Use the search bar to find any asset. Switch models with the tabs in the panel header. Open up to 4 charts at once with the layout selector.',
      'Data updates daily after market close.',
    ],
  },
];

const DEMO_STEPS: Step[] = [
  ...SHARED_STEPS,
  {
    title: 'Demo Limitations',
    body: [
      'The demo includes 5 assets to explore — SPX, NQ, BTCUSD, CL, and GC.',
      'The full Stats dashboard is only available with a subscription. Sign up to access 1,200+ assets and all filtering tools.',
    ],
  },
];

interface OnboardingPopupProps {
  storageKey: string;
  alwaysShow?: boolean;
  forceOpen?: boolean;
  onClose?: () => void;
  variant?: 'demo' | 'terminal';
}

export default function OnboardingPopup({ storageKey, alwaysShow, forceOpen, onClose, variant = 'terminal' }: OnboardingPopupProps) {
  const steps = variant === 'demo' ? DEMO_STEPS : TERMINAL_STEPS;
  const [visible, setVisible] = useState(alwaysShow ?? false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (alwaysShow) {
      setVisible(true);
      return;
    }
    const dismissed = localStorage.getItem(storageKey);
    if (!dismissed) setVisible(true);
  }, [storageKey, alwaysShow]);

  useEffect(() => {
    if (forceOpen) {
      setStep(0);
      setVisible(true);
    }
  }, [forceOpen]);

  if (!visible) return null;

  const current = steps[step];
  const isFirst = step === 0;
  const isLast = step === steps.length - 1;

  const dismiss = () => {
    localStorage.setItem(storageKey, '1');
    setVisible(false);
    onClose?.();
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
      onClick={dismiss}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 480,
          margin: '0 20px',
          borderRadius: 20,
          background: 'rgba(255,255,255,0.75)',
          backdropFilter: 'blur(60px) saturate(2)',
          WebkitBackdropFilter: 'blur(60px) saturate(2)',
          border: '1px solid rgba(255,255,255,0.8)',
          boxShadow: '0 12px 48px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.95)',
          padding: '32px 28px 24px',
        }}
      >
        {/* Step indicator */}
        <div className="flex items-center gap-1.5" style={{ marginBottom: 20 }}>
          {steps.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === step ? 20 : 6,
                height: 6,
                borderRadius: 3,
                background: i === step ? '#111827' : 'rgba(0,0,0,0.15)',
                transition: 'all 0.2s',
              }}
            />
          ))}
        </div>

        {/* Title */}
        <h2
          style={{
            fontFamily: "'Instrument Serif', Georgia, serif",
            fontSize: 26,
            fontWeight: 400,
            color: '#111827',
            marginBottom: 14,
            lineHeight: 1.2,
          }}
        >
          {current.title}
        </h2>

        {/* Body */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
          {current.body.map((paragraph, i) => (
            <p
              key={i}
              style={{
                fontSize: 14,
                lineHeight: 1.65,
                color: '#374151',
                margin: 0,
              }}
            >
              {paragraph}
            </p>
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={dismiss}
            style={{
              fontFamily: MONO,
              fontSize: 11,
              letterSpacing: '0.03em',
              color: '#9ca3af',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px 0',
            }}
          >
            Skip
          </button>

          <div className="flex items-center gap-2">
            {!isFirst && (
              <button
                onClick={() => setStep(step - 1)}
                style={{
                  fontFamily: MONO,
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#374151',
                  background: 'rgba(255,255,255,0.5)',
                  border: '1px solid rgba(0,0,0,0.1)',
                  padding: '8px 18px',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.7)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.5)'; }}
              >
                Back
              </button>
            )}
            <button
              onClick={isLast ? dismiss : () => setStep(step + 1)}
              style={{
                fontFamily: MONO,
                fontSize: 12,
                fontWeight: 600,
                color: '#ffffff',
                background: '#111827',
                border: '1px solid #111827',
                padding: '8px 18px',
                cursor: 'pointer',
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85'; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
            >
              {isLast ? 'Get Started' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
