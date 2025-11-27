import { useState } from 'react';
import { Link } from 'wouter';
import { Check, Heart, Building2, Users, Activity, Smartphone, TrendingUp, Shield, Zap, MessageSquare, Headphones, ArrowRight, Sparkles, Star, ChevronDown } from 'lucide-react';

type BillingPeriod = 'monthly' | 'annual';

export default function Plans() {
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('annual');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const patientPlans = [
    {
      name: 'Basic',
      conditions: '1-2 conditions',
      monthlyPrice: 15000,
      annualPrice: 144000,
      annualMonthly: 12000,
      icon: Heart,
      color: 'from-rose-500 to-pink-500',
      features: [
        'Health vitals tracking',
        'Mobile app sync (iOS/Android)',
        'Basic health trends',
        'Assigned clinician access',
      ],
      popular: false,
    },
    {
      name: 'Standard',
      conditions: '3-5 conditions',
      monthlyPrice: 30000,
      annualPrice: 288000,
      annualMonthly: 24000,
      icon: Activity,
      color: 'from-medical-blue-500 to-blue-600',
      features: [
        'Everything in Basic',
        'Track up to 5 conditions',
        'Detailed health analytics',
        'Email alerts & summaries',
      ],
      popular: true,
    },
    {
      name: 'Premium',
      conditions: 'Unlimited conditions',
      monthlyPrice: 45000,
      annualPrice: 432000,
      annualMonthly: 36000,
      icon: Sparkles,
      color: 'from-violet-500 to-purple-600',
      features: [
        'Everything in Standard',
        'Unlimited condition tracking',
        'Priority clinician matching',
        'Advanced analytics & insights',
        'Family sharing (up to 3 members)',
      ],
      popular: false,
    },
  ];

  const enterprisePlans = [
    {
      name: 'Starter',
      patients: 'Up to 100 patients',
      monthlyPrice: 450000,
      annualPrice: 4500000,
      icon: Building2,
      color: 'from-emerald-500 to-teal-500',
      features: [
        'Admin dashboard',
        'Clinician management',
        'Basic alerts & monitoring',
        'Email support',
        'Standard reporting',
      ],
      popular: false,
    },
    {
      name: 'Professional',
      patients: 'Up to 500 patients',
      monthlyPrice: 1200000,
      annualPrice: 12000000,
      icon: Zap,
      color: 'from-medical-blue-500 to-indigo-600',
      features: [
        'Everything in Starter',
        'AI risk insights',
        'SMS/voice alerts',
        'Priority support',
        'Custom branding',
        'Patient referral system',
      ],
      popular: true,
    },
    {
      name: 'Enterprise',
      patients: 'Unlimited patients',
      monthlyPrice: null,
      annualPrice: null,
      icon: Star,
      color: 'from-amber-500 to-orange-500',
      features: [
        'Everything in Professional',
        'Dedicated account manager',
        'Custom integrations',
        'SLA guarantees',
        'On-premise options',
        'Advanced patient referral analytics',
      ],
      popular: false,
    },
  ];

  const faqs = [
    {
      q: 'What counts as a "condition" for patient plans?',
      a: 'A condition is any health issue you want to monitor, such as diabetes, hypertension, heart disease, sleep apnea, etc. Each condition typically involves tracking specific vital signs relevant to that health concern.',
    },
    {
      q: 'Can I switch plans later?',
      a: 'Yes! You can upgrade or downgrade your plan at any time. When upgrading, you\'ll get immediate access to new features. When downgrading, the change takes effect at your next billing cycle.',
    },
    {
      q: 'What devices are supported?',
      a: 'VeriHealth integrates with Apple HealthKit (iOS) and Health Connect (Android), allowing data from most popular health devices including Apple Watch, Fitbit, Garmin, Withings, and many others.',
    },
    {
      q: 'How does the patient referral system work?',
      a: 'Available on Professional and Enterprise plans, the patient referral system allows clinicians to refer patients to specialists within the network, track referral status, and share relevant health data securely.',
    },
    {
      q: 'Is there a free trial?',
      a: 'We offer a 14-day free trial for all patient plans and a 30-day pilot program for enterprise customers. Contact our sales team to get started.',
    },
    {
      q: 'What payment methods do you accept?',
      a: 'We accept all major credit cards (Visa, Mastercard, Verve), bank transfers, and mobile payments (Paystack, Flutterwave). Enterprise customers can also pay via direct bank transfer.',
    },
  ];

  return (
    <div className="bg-white">
      {/* Compact Hero Section */}
      <section className="relative bg-gradient-to-r from-slate-900 via-medical-blue-900 to-slate-900 py-6 lg:py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-heading font-bold text-white tracking-tight">
                Choose Your <span className="bg-gradient-to-r from-medical-blue-400 to-cyan-400 bg-clip-text text-transparent">Health Plan</span>
              </h1>
              <p className="text-sm text-slate-400 mt-1">Simple, transparent pricing for patients and institutions</p>
            </div>
            
            {/* Billing Toggle */}
            <div className="inline-flex items-center bg-white/10 backdrop-blur-sm rounded-lg p-1">
              <button
                onClick={() => setBillingPeriod('monthly')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  billingPeriod === 'monthly'
                    ? 'bg-white text-slate-900 shadow'
                    : 'text-white/70 hover:text-white'
                }`}
                data-testid="button-billing-monthly"
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingPeriod('annual')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                  billingPeriod === 'annual'
                    ? 'bg-white text-slate-900 shadow'
                    : 'text-white/70 hover:text-white'
                }`}
                data-testid="button-billing-annual"
              >
                Annual
                <span className="bg-emerald-500 text-white text-xs px-1.5 py-0.5 rounded font-bold">-20%</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Patient Plans Section */}
      <section className="py-8 lg:py-10 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="inline-flex items-center gap-2 bg-rose-100 text-rose-700 px-3 py-1.5 rounded-full text-sm font-semibold">
              <Heart className="h-4 w-4" />
              For Patients
            </div>
            <p className="text-slate-600 text-sm hidden sm:block">Pay based on conditions monitored</p>
          </div>

          <div className="grid lg:grid-cols-3 gap-4 lg:gap-6">
            {patientPlans.map((plan) => (
              <div
                key={plan.name}
                className={`relative ${plan.popular ? 'lg:-mt-2' : ''}`}
                data-testid={`card-patient-plan-${plan.name.toLowerCase()}`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                    <span className="bg-medical-blue-600 text-white px-3 py-1 rounded-full text-xs font-semibold shadow-lg">
                      Most Popular
                    </span>
                  </div>
                )}
                
                <div className={`h-full bg-white rounded-2xl border transition-all duration-300 overflow-hidden ${
                  plan.popular
                    ? 'border-medical-blue-500 shadow-lg shadow-medical-blue-500/10 ring-1 ring-medical-blue-500'
                    : 'border-slate-200 hover:border-slate-300 hover:shadow-lg'
                }`}>
                  {/* Gradient Header */}
                  <div className={`bg-gradient-to-r ${plan.color} px-5 py-4 relative overflow-hidden`}>
                    <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
                    <div className="relative flex items-center justify-between">
                      <div>
                        <h3 className="text-xl font-heading font-bold text-white">{plan.name}</h3>
                        <p className="text-white/80 text-xs">{plan.conditions}</p>
                      </div>
                      <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
                        <plan.icon className="h-5 w-5 text-white" />
                      </div>
                    </div>
                  </div>

                  <div className="p-5">
                    {/* Price */}
                    <div className="mb-4">
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-heading font-bold text-slate-900">
                          ₦{(billingPeriod === 'monthly' ? plan.monthlyPrice : plan.annualMonthly).toLocaleString()}
                        </span>
                        <span className="text-slate-500 text-sm">/mo</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {billingPeriod === 'annual' 
                          ? `Billed at ₦${plan.annualPrice.toLocaleString()}/year`
                          : <span className="text-emerald-600">Save ₦{((plan.monthlyPrice - plan.annualMonthly) * 12).toLocaleString()}/yr with annual</span>
                        }
                      </p>
                    </div>

                    {/* Features */}
                    <ul className="space-y-2.5 mb-5">
                      {plan.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <div className="h-5 w-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Check className="h-3 w-3 text-emerald-600" strokeWidth={3} />
                          </div>
                          <span className="text-slate-700 text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    {/* CTA */}
                    <Link
                      href="/portal"
                      className={`block w-full text-center py-2.5 px-4 rounded-lg text-sm font-semibold transition-all ${
                        plan.popular
                          ? 'bg-medical-blue-600 text-white hover:bg-medical-blue-700'
                          : 'bg-slate-100 text-slate-900 hover:bg-slate-200'
                      }`}
                      data-testid={`button-select-patient-${plan.name.toLowerCase()}`}
                    >
                      Start Free Trial
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Patient Features Strip */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4 lg:gap-8">
            {[
              { icon: Smartphone, label: 'iOS & Android' },
              { icon: Activity, label: 'Real-time Vitals' },
              { icon: TrendingUp, label: 'Health Trends' },
              { icon: Shield, label: 'Secure & Private' },
            ].map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 text-slate-600">
                <item.icon className="h-4 w-4 text-medical-blue-600" />
                <span className="text-sm font-medium">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Enterprise Plans Section */}
      <section className="py-8 lg:py-10 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full text-sm font-semibold">
              <Building2 className="h-4 w-4" />
              For Institutions
            </div>
            <p className="text-slate-600 text-sm hidden sm:block">Scale based on patient capacity</p>
          </div>

          <div className="grid lg:grid-cols-3 gap-4 lg:gap-6">
            {enterprisePlans.map((plan) => (
              <div
                key={plan.name}
                className={`relative ${plan.popular ? 'lg:-mt-2' : ''}`}
                data-testid={`card-enterprise-plan-${plan.name.toLowerCase()}`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                    <span className="bg-medical-blue-600 text-white px-3 py-1 rounded-full text-xs font-semibold shadow-lg">
                      Most Popular
                    </span>
                  </div>
                )}
                
                <div className={`h-full bg-white rounded-2xl border transition-all duration-300 overflow-hidden ${
                  plan.popular
                    ? 'border-medical-blue-500 shadow-lg shadow-medical-blue-500/10 ring-1 ring-medical-blue-500'
                    : 'border-slate-200 hover:border-slate-300 hover:shadow-lg'
                }`}>
                  {/* Gradient Header */}
                  <div className={`bg-gradient-to-r ${plan.color} px-5 py-4 relative overflow-hidden`}>
                    <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
                    <div className="relative flex items-center justify-between">
                      <div>
                        <h3 className="text-xl font-heading font-bold text-white">{plan.name}</h3>
                        <p className="text-white/80 text-xs flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {plan.patients}
                        </p>
                      </div>
                      <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
                        <plan.icon className="h-5 w-5 text-white" />
                      </div>
                    </div>
                  </div>

                  <div className="p-5">
                    {/* Price */}
                    <div className="mb-4">
                      {plan.monthlyPrice !== null ? (
                        <>
                          <div className="flex items-baseline gap-1">
                            <span className="text-4xl font-heading font-bold text-slate-900">
                              ₦{(billingPeriod === 'monthly' ? plan.monthlyPrice : Math.round(plan.annualPrice! / 12)).toLocaleString()}
                            </span>
                            <span className="text-slate-500 text-sm">/mo</span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            {billingPeriod === 'annual'
                              ? `Billed at ₦${plan.annualPrice?.toLocaleString()}/year`
                              : <span className="text-emerald-600">Save ₦{((plan.monthlyPrice * 12) - plan.annualPrice!).toLocaleString()}/yr with annual</span>
                            }
                          </p>
                        </>
                      ) : (
                        <>
                          <div className="text-4xl font-heading font-bold text-slate-900">Custom</div>
                          <p className="text-xs text-slate-500 mt-1">Tailored to your needs</p>
                        </>
                      )}
                    </div>

                    {/* Features */}
                    <ul className="space-y-2.5 mb-5">
                      {plan.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <div className="h-5 w-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Check className="h-3 w-3 text-emerald-600" strokeWidth={3} />
                          </div>
                          <span className="text-slate-700 text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    {/* CTA */}
                    <Link
                      href={plan.name === 'Enterprise' ? '/contact' : '/portal'}
                      className={`block w-full text-center py-2.5 px-4 rounded-lg text-sm font-semibold transition-all ${
                        plan.popular
                          ? 'bg-medical-blue-600 text-white hover:bg-medical-blue-700'
                          : plan.name === 'Enterprise'
                          ? 'bg-slate-900 text-white hover:bg-slate-800'
                          : 'bg-slate-100 text-slate-900 hover:bg-slate-200'
                      }`}
                      data-testid={`button-select-enterprise-${plan.name.toLowerCase()}`}
                    >
                      {plan.name === 'Enterprise' ? 'Contact Sales' : 'Get Started'}
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Enterprise Features Strip */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4 lg:gap-8">
            {[
              { icon: Zap, label: 'AI Risk Insights' },
              { icon: MessageSquare, label: 'SMS/Voice Alerts' },
              { icon: Users, label: 'Patient Referrals' },
              { icon: Headphones, label: 'Priority Support' },
            ].map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 text-slate-600">
                <item.icon className="h-4 w-4 text-medical-blue-600" />
                <span className="text-sm font-medium">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-8 lg:py-10 bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-xl font-heading font-bold text-slate-900 mb-4">
            Frequently Asked Questions
          </h2>

          <div className="space-y-2">
            {faqs.map((faq, idx) => (
              <div 
                key={idx} 
                className="bg-white rounded-xl border border-slate-200 overflow-hidden"
                data-testid={`faq-item-${idx}`}
              >
                <button
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full flex items-center justify-between p-4 text-left"
                >
                  <h3 className="text-sm font-semibold text-slate-900 pr-4">{faq.q}</h3>
                  <div className={`h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 transition-transform duration-200 ${openFaq === idx ? 'rotate-180' : ''}`}>
                    <ChevronDown className="h-4 w-4 text-slate-600" />
                  </div>
                </button>
                <div className={`overflow-hidden transition-all duration-200 ${openFaq === idx ? 'max-h-48' : 'max-h-0'}`}>
                  <p className="px-4 pb-4 text-slate-600 text-sm">{faq.a}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-10 lg:py-12 bg-gradient-to-r from-medical-blue-600 to-indigo-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl lg:text-3xl font-heading font-bold text-white mb-3">
            Ready to Transform Your Health Monitoring?
          </h2>
          <p className="text-blue-100 mb-6 text-sm lg:text-base">
            Join thousands of patients and healthcare providers already using VeriHealth.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/portal"
              className="inline-flex items-center justify-center gap-2 bg-white text-medical-blue-600 px-6 py-3 rounded-lg font-semibold text-sm hover:bg-blue-50 transition-all"
              data-testid="button-cta-start-free"
            >
              Start Free Trial
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center gap-2 bg-transparent text-white border border-white/30 px-6 py-3 rounded-lg font-semibold text-sm hover:bg-white/10 transition-all"
              data-testid="button-cta-contact-sales"
            >
              Contact Sales
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
