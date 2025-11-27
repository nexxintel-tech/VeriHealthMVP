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
      monthlyPrice: 9.99,
      annualPrice: 95.88,
      annualMonthly: 7.99,
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
      monthlyPrice: 19.99,
      annualPrice: 191.88,
      annualMonthly: 15.99,
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
      monthlyPrice: 29.99,
      annualPrice: 287.88,
      annualMonthly: 23.99,
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
      monthlyPrice: 299,
      annualPrice: 2990,
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
      monthlyPrice: 799,
      annualPrice: 7990,
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
      a: 'We accept all major credit cards (Visa, Mastercard, American Express) and ACH bank transfers for enterprise customers. All payments are processed securely through Stripe.',
    },
  ];

  return (
    <div className="bg-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-medical-blue-900 to-slate-900 py-24 lg:py-32">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-medical-blue-500/20 via-transparent to-transparent"></div>
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-medical-blue-500/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2 mb-6">
              <Sparkles className="h-4 w-4 text-yellow-400" />
              <span className="text-sm text-white/90">Simple, transparent pricing</span>
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-heading font-bold text-white mb-6 tracking-tight">
              Choose Your
              <span className="block bg-gradient-to-r from-medical-blue-400 via-cyan-400 to-teal-400 bg-clip-text text-transparent">
                Health Plan
              </span>
            </h1>
            
            <p className="text-lg lg:text-xl text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed">
              Whether you're a patient monitoring your health or an institution scaling your program, we have the perfect plan for you.
            </p>

            {/* Billing Toggle */}
            <div className="inline-flex items-center bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-2">
              <button
                onClick={() => setBillingPeriod('monthly')}
                className={`relative px-8 py-3.5 rounded-xl text-sm font-semibold transition-all duration-300 ${
                  billingPeriod === 'monthly'
                    ? 'bg-white text-slate-900 shadow-lg shadow-white/25'
                    : 'text-white/70 hover:text-white'
                }`}
                data-testid="button-billing-monthly"
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingPeriod('annual')}
                className={`relative px-8 py-3.5 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center gap-2 ${
                  billingPeriod === 'annual'
                    ? 'bg-white text-slate-900 shadow-lg shadow-white/25'
                    : 'text-white/70 hover:text-white'
                }`}
                data-testid="button-billing-annual"
              >
                Annual
                <span className="bg-gradient-to-r from-emerald-500 to-green-500 text-white text-xs px-2.5 py-1 rounded-full font-bold">
                  -20%
                </span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Patient Plans Section */}
      <section className="py-24 lg:py-32 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-rose-100 to-pink-100 text-rose-700 px-5 py-2.5 rounded-full text-sm font-semibold mb-6 shadow-sm">
              <Heart className="h-4 w-4" />
              For Patients
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-heading font-bold text-slate-900 mb-5">
              Patient Plans
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Monitor your health conditions with ease. Pay based on the number of conditions you need to track.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-6 lg:gap-8 max-w-6xl mx-auto">
            {patientPlans.map((plan) => (
              <div
                key={plan.name}
                className={`relative group ${plan.popular ? 'lg:-mt-4 lg:mb-4' : ''}`}
                data-testid={`card-patient-plan-${plan.name.toLowerCase()}`}
              >
                {plan.popular && (
                  <div className="absolute -top-5 left-0 right-0 flex justify-center z-10">
                    <span className="bg-gradient-to-r from-medical-blue-600 to-blue-600 text-white px-6 py-2 rounded-full text-sm font-semibold shadow-lg shadow-medical-blue-500/30">
                      Most Popular
                    </span>
                  </div>
                )}
                
                <div className={`h-full bg-white rounded-3xl border-2 transition-all duration-300 overflow-hidden ${
                  plan.popular
                    ? 'border-medical-blue-500 shadow-xl shadow-medical-blue-500/10'
                    : 'border-slate-200 hover:border-slate-300 hover:shadow-xl'
                }`}>
                  {/* Gradient Header */}
                  <div className={`bg-gradient-to-r ${plan.color} p-6 relative overflow-hidden`}>
                    <div className="absolute inset-0 bg-black/10"></div>
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
                    <div className="relative flex items-center justify-between">
                      <div>
                        <h3 className="text-2xl font-heading font-bold text-white mb-1">
                          {plan.name}
                        </h3>
                        <p className="text-white/80 text-sm">{plan.conditions}</p>
                      </div>
                      <div className="h-14 w-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                        <plan.icon className="h-7 w-7 text-white" />
                      </div>
                    </div>
                  </div>

                  <div className="p-8">
                    {/* Price */}
                    <div className="mb-8">
                      <div className="flex items-baseline gap-1">
                        <span className="text-5xl font-heading font-bold text-slate-900">
                          ${billingPeriod === 'monthly' ? plan.monthlyPrice : plan.annualMonthly}
                        </span>
                        <span className="text-slate-500 font-medium">/month</span>
                      </div>
                      {billingPeriod === 'annual' && (
                        <p className="text-sm text-slate-500 mt-2">
                          Billed annually at <span className="font-semibold">${plan.annualPrice}</span>/year
                        </p>
                      )}
                      {billingPeriod === 'monthly' && (
                        <p className="text-sm text-emerald-600 mt-2 font-medium">
                          Save ${((plan.monthlyPrice - plan.annualMonthly) * 12).toFixed(0)}/year with annual
                        </p>
                      )}
                    </div>

                    {/* Features */}
                    <ul className="space-y-4 mb-8">
                      {plan.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-3">
                          <div className="h-6 w-6 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Check className="h-3.5 w-3.5 text-emerald-600" strokeWidth={3} />
                          </div>
                          <span className="text-slate-700">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    {/* CTA */}
                    <Link
                      href="/portal"
                      className={`block w-full text-center py-4 px-6 rounded-xl font-semibold transition-all duration-300 ${
                        plan.popular
                          ? 'bg-gradient-to-r from-medical-blue-600 to-blue-600 text-white hover:shadow-lg hover:shadow-medical-blue-500/30 hover:-translate-y-0.5'
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
          <div className="mt-20 bg-gradient-to-r from-slate-900 to-slate-800 rounded-3xl p-8 lg:p-10">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
              {[
                { icon: Smartphone, label: 'iOS & Android App', desc: 'Sync from any device' },
                { icon: Activity, label: 'Real-time Vitals', desc: 'Live health monitoring' },
                { icon: TrendingUp, label: 'Health Trends', desc: 'Track your progress' },
                { icon: Shield, label: 'Secure & Private', desc: 'Your data protected' },
              ].map((item, idx) => (
                <div key={idx} className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center flex-shrink-0">
                    <item.icon className="h-6 w-6 text-medical-blue-400" />
                  </div>
                  <div>
                    <span className="text-white font-semibold block">{item.label}</span>
                    <span className="text-slate-400 text-sm">{item.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Enterprise Plans Section */}
      <section className="py-24 lg:py-32 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-700 px-5 py-2.5 rounded-full text-sm font-semibold mb-6 shadow-sm">
              <Building2 className="h-4 w-4" />
              For Healthcare Institutions
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-heading font-bold text-slate-900 mb-5">
              Enterprise Plans
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Scale your remote patient monitoring program. Pay based on patient capacity.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-6 lg:gap-8 max-w-6xl mx-auto">
            {enterprisePlans.map((plan) => (
              <div
                key={plan.name}
                className={`relative group ${plan.popular ? 'lg:-mt-4 lg:mb-4' : ''}`}
                data-testid={`card-enterprise-plan-${plan.name.toLowerCase()}`}
              >
                {plan.popular && (
                  <div className="absolute -top-5 left-0 right-0 flex justify-center z-10">
                    <span className="bg-gradient-to-r from-medical-blue-600 to-indigo-600 text-white px-6 py-2 rounded-full text-sm font-semibold shadow-lg shadow-medical-blue-500/30">
                      Most Popular
                    </span>
                  </div>
                )}
                
                <div className={`h-full bg-white rounded-3xl border-2 transition-all duration-300 overflow-hidden ${
                  plan.popular
                    ? 'border-medical-blue-500 shadow-xl shadow-medical-blue-500/10'
                    : 'border-slate-200 hover:border-slate-300 hover:shadow-xl'
                }`}>
                  {/* Gradient Header */}
                  <div className={`bg-gradient-to-r ${plan.color} p-6 relative overflow-hidden`}>
                    <div className="absolute inset-0 bg-black/10"></div>
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
                    <div className="relative flex items-center justify-between">
                      <div>
                        <h3 className="text-2xl font-heading font-bold text-white mb-1">
                          {plan.name}
                        </h3>
                        <p className="text-white/80 text-sm flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5" />
                          {plan.patients}
                        </p>
                      </div>
                      <div className="h-14 w-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                        <plan.icon className="h-7 w-7 text-white" />
                      </div>
                    </div>
                  </div>

                  <div className="p-8">
                    {/* Price */}
                    <div className="mb-8">
                      {plan.monthlyPrice !== null ? (
                        <>
                          <div className="flex items-baseline gap-1">
                            <span className="text-5xl font-heading font-bold text-slate-900">
                              ${billingPeriod === 'monthly' ? plan.monthlyPrice : Math.round(plan.annualPrice! / 12)}
                            </span>
                            <span className="text-slate-500 font-medium">/month</span>
                          </div>
                          {billingPeriod === 'annual' && (
                            <p className="text-sm text-slate-500 mt-2">
                              Billed annually at <span className="font-semibold">${plan.annualPrice?.toLocaleString()}</span>/year
                            </p>
                          )}
                          {billingPeriod === 'monthly' && (
                            <p className="text-sm text-emerald-600 mt-2 font-medium">
                              Save ${((plan.monthlyPrice * 12) - plan.annualPrice!).toLocaleString()}/year with annual
                            </p>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="text-5xl font-heading font-bold text-slate-900">
                            Custom
                          </div>
                          <p className="text-sm text-slate-500 mt-2">
                            Tailored to your organization's needs
                          </p>
                        </>
                      )}
                    </div>

                    {/* Features */}
                    <ul className="space-y-4 mb-8">
                      {plan.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-3">
                          <div className="h-6 w-6 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Check className="h-3.5 w-3.5 text-emerald-600" strokeWidth={3} />
                          </div>
                          <span className="text-slate-700">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    {/* CTA */}
                    <Link
                      href={plan.name === 'Enterprise' ? '/contact' : '/portal'}
                      className={`block w-full text-center py-4 px-6 rounded-xl font-semibold transition-all duration-300 ${
                        plan.popular
                          ? 'bg-gradient-to-r from-medical-blue-600 to-indigo-600 text-white hover:shadow-lg hover:shadow-medical-blue-500/30 hover:-translate-y-0.5'
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
          <div className="mt-20 bg-gradient-to-br from-slate-100 to-slate-50 rounded-3xl p-8 lg:p-10 border border-slate-200">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
              {[
                { icon: Zap, label: 'AI Risk Insights', desc: 'Predictive analytics' },
                { icon: MessageSquare, label: 'SMS/Voice Alerts', desc: 'Multi-channel notifications' },
                { icon: Users, label: 'Patient Referrals', desc: 'Seamless coordination' },
                { icon: Headphones, label: 'Priority Support', desc: 'Dedicated assistance' },
              ].map((item, idx) => (
                <div key={idx} className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-white shadow-sm border border-slate-200 flex items-center justify-center flex-shrink-0">
                    <item.icon className="h-6 w-6 text-medical-blue-600" />
                  </div>
                  <div>
                    <span className="text-slate-900 font-semibold block">{item.label}</span>
                    <span className="text-slate-500 text-sm">{item.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-24 lg:py-32 bg-gradient-to-b from-white to-slate-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-heading font-bold text-slate-900 mb-5">
              Frequently Asked Questions
            </h2>
            <p className="text-lg text-slate-600">
              Everything you need to know about our plans
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => (
              <div 
                key={idx} 
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden transition-all duration-300 hover:shadow-md"
                data-testid={`faq-item-${idx}`}
              >
                <button
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full flex items-center justify-between p-6 text-left"
                >
                  <h3 className="text-lg font-semibold text-slate-900 pr-4">{faq.q}</h3>
                  <div className={`h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 transition-transform duration-300 ${openFaq === idx ? 'rotate-180' : ''}`}>
                    <ChevronDown className="h-5 w-5 text-slate-600" />
                  </div>
                </button>
                <div className={`overflow-hidden transition-all duration-300 ${openFaq === idx ? 'max-h-96' : 'max-h-0'}`}>
                  <p className="px-6 pb-6 text-slate-600 leading-relaxed">{faq.a}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 lg:py-32 bg-gradient-to-br from-medical-blue-600 via-blue-600 to-indigo-700 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-white/5 rounded-full blur-3xl"></div>
        </div>
        
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2 mb-6">
            <Sparkles className="h-4 w-4 text-yellow-300" />
            <span className="text-sm text-white/90">14-day free trial</span>
          </div>
          
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-heading font-bold text-white mb-6">
            Ready to Transform Your
            <span className="block">Health Monitoring?</span>
          </h2>
          <p className="text-xl text-blue-100 mb-10 max-w-2xl mx-auto">
            Join thousands of patients and healthcare providers already using VeriHealth to improve outcomes.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/portal"
              className="inline-flex items-center justify-center gap-2 bg-white text-medical-blue-600 px-8 py-4 rounded-xl font-semibold hover:bg-blue-50 transition-all shadow-lg shadow-black/20 hover:-translate-y-0.5"
              data-testid="button-cta-start-free"
            >
              Start Free Trial
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center gap-2 bg-transparent text-white border-2 border-white/30 px-8 py-4 rounded-xl font-semibold hover:bg-white/10 hover:border-white/50 transition-all"
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
