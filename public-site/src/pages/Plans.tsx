import { useState } from 'react';
import { Link } from 'wouter';
import { Check, Heart, Building2, Users, Activity, Smartphone, TrendingUp, Shield, Zap, MessageSquare, Headphones, ArrowRight } from 'lucide-react';

type BillingPeriod = 'monthly' | 'annual';

export default function Plans() {
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');

  const patientPlans = [
    {
      name: 'Basic',
      conditions: '1-2 conditions',
      monthlyPrice: 9.99,
      annualPrice: 95.88,
      annualMonthly: 7.99,
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

  const formatPrice = (price: number | null) => {
    if (price === null) return 'Custom';
    return `$${price.toLocaleString()}`;
  };

  return (
    <div className="bg-white">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-medical-blue-600 via-medical-blue-700 to-medical-blue-800 py-20 lg:py-28">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djZoNnYtNmgtNnptMC0xMHY2aDZ2LTZoLTZ6bTEwIDEwdjZoNnYtNmgtNnptMC0xMHY2aDZ2LTZoLTZ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center">
            <h1 className="text-4xl lg:text-6xl font-heading font-bold text-white mb-6">
              Simple, Transparent Pricing
            </h1>
            <p className="text-xl text-medical-blue-100 max-w-3xl mx-auto mb-8">
              Choose the plan that fits your needs. Whether you're a patient looking to monitor your health or a healthcare institution scaling your remote monitoring program.
            </p>

            {/* Billing Toggle */}
            <div className="inline-flex items-center bg-white/10 backdrop-blur-sm rounded-full p-1.5">
              <button
                onClick={() => setBillingPeriod('monthly')}
                className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all ${
                  billingPeriod === 'monthly'
                    ? 'bg-white text-medical-blue-600 shadow-md'
                    : 'text-white hover:bg-white/10'
                }`}
                data-testid="button-billing-monthly"
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingPeriod('annual')}
                className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all ${
                  billingPeriod === 'annual'
                    ? 'bg-white text-medical-blue-600 shadow-md'
                    : 'text-white hover:bg-white/10'
                }`}
                data-testid="button-billing-annual"
              >
                Annual
                <span className="ml-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">
                  Save 20%
                </span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Patient Plans Section */}
      <section className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-pink-100 text-pink-700 px-4 py-2 rounded-full text-sm font-medium mb-4">
              <Heart className="h-4 w-4" />
              For Patients
            </div>
            <h2 className="text-3xl lg:text-5xl font-heading font-bold text-gray-900 mb-4">
              Patient Plans
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Monitor your health conditions with ease. Pay based on the number of conditions you need to track.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {patientPlans.map((plan) => (
              <div
                key={plan.name}
                className={`relative bg-white rounded-2xl border-2 p-8 transition-all hover:shadow-xl ${
                  plan.popular
                    ? 'border-medical-blue-500 shadow-lg'
                    : 'border-gray-200 hover:border-medical-blue-300'
                }`}
                data-testid={`card-patient-plan-${plan.name.toLowerCase()}`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="bg-medical-blue-600 text-white px-4 py-1.5 rounded-full text-sm font-medium">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="text-center mb-6">
                  <h3 className="text-2xl font-heading font-bold text-gray-900 mb-2">
                    {plan.name}
                  </h3>
                  <p className="text-gray-500 text-sm">{plan.conditions}</p>
                </div>

                <div className="text-center mb-8">
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-5xl font-heading font-bold text-gray-900">
                      ${billingPeriod === 'monthly' ? plan.monthlyPrice : plan.annualMonthly}
                    </span>
                    <span className="text-gray-500">/mo</span>
                  </div>
                  {billingPeriod === 'annual' && (
                    <p className="text-sm text-gray-500 mt-2">
                      Billed annually at ${plan.annualPrice}/year
                    </p>
                  )}
                </div>

                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-600">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/portal"
                  className={`block w-full text-center py-3 px-6 rounded-lg font-medium transition-all ${
                    plan.popular
                      ? 'bg-medical-blue-600 text-white hover:bg-medical-blue-700'
                      : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                  }`}
                  data-testid={`button-select-patient-${plan.name.toLowerCase()}`}
                >
                  Get Started
                </Link>
              </div>
            ))}
          </div>

          {/* Patient Features */}
          <div className="mt-16 grid md:grid-cols-4 gap-6">
            {[
              { icon: Smartphone, label: 'iOS & Android App' },
              { icon: Activity, label: 'Real-time Vitals' },
              { icon: TrendingUp, label: 'Health Trends' },
              { icon: Shield, label: 'Secure & Private' },
            ].map((item, idx) => (
              <div key={idx} className="flex items-center gap-3 bg-gray-50 rounded-lg p-4">
                <item.icon className="h-6 w-6 text-medical-blue-600" />
                <span className="text-gray-700 font-medium">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Enterprise Plans Section */}
      <section className="py-20 lg:py-28 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm font-medium mb-4">
              <Building2 className="h-4 w-4" />
              For Healthcare Institutions
            </div>
            <h2 className="text-3xl lg:text-5xl font-heading font-bold text-gray-900 mb-4">
              Enterprise Plans
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Scale your remote patient monitoring program with our comprehensive platform. Pay based on patient capacity.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {enterprisePlans.map((plan) => (
              <div
                key={plan.name}
                className={`relative bg-white rounded-2xl border-2 p-8 transition-all hover:shadow-xl ${
                  plan.popular
                    ? 'border-medical-blue-500 shadow-lg'
                    : 'border-gray-200 hover:border-medical-blue-300'
                }`}
                data-testid={`card-enterprise-plan-${plan.name.toLowerCase()}`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="bg-medical-blue-600 text-white px-4 py-1.5 rounded-full text-sm font-medium">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="text-center mb-6">
                  <h3 className="text-2xl font-heading font-bold text-gray-900 mb-2">
                    {plan.name}
                  </h3>
                  <p className="text-gray-500 text-sm flex items-center justify-center gap-1">
                    <Users className="h-4 w-4" />
                    {plan.patients}
                  </p>
                </div>

                <div className="text-center mb-8">
                  {plan.monthlyPrice !== null ? (
                    <>
                      <div className="flex items-baseline justify-center gap-1">
                        <span className="text-5xl font-heading font-bold text-gray-900">
                          {formatPrice(billingPeriod === 'monthly' ? plan.monthlyPrice : Math.round(plan.annualPrice! / 12))}
                        </span>
                        <span className="text-gray-500">/mo</span>
                      </div>
                      {billingPeriod === 'annual' && (
                        <p className="text-sm text-gray-500 mt-2">
                          Billed annually at ${plan.annualPrice?.toLocaleString()}/year
                        </p>
                      )}
                    </>
                  ) : (
                    <div className="text-5xl font-heading font-bold text-gray-900">
                      Custom
                    </div>
                  )}
                </div>

                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-600">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={plan.name === 'Enterprise' ? '/contact' : '/portal'}
                  className={`block w-full text-center py-3 px-6 rounded-lg font-medium transition-all ${
                    plan.popular
                      ? 'bg-medical-blue-600 text-white hover:bg-medical-blue-700'
                      : plan.name === 'Enterprise'
                      ? 'bg-gray-900 text-white hover:bg-gray-800'
                      : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                  }`}
                  data-testid={`button-select-enterprise-${plan.name.toLowerCase()}`}
                >
                  {plan.name === 'Enterprise' ? 'Contact Sales' : 'Get Started'}
                </Link>
              </div>
            ))}
          </div>

          {/* Enterprise Features */}
          <div className="mt-16 grid md:grid-cols-4 gap-6">
            {[
              { icon: Zap, label: 'AI Risk Insights' },
              { icon: MessageSquare, label: 'SMS/Voice Alerts' },
              { icon: Users, label: 'Patient Referrals' },
              { icon: Headphones, label: 'Priority Support' },
            ].map((item, idx) => (
              <div key={idx} className="flex items-center gap-3 bg-white rounded-lg p-4 shadow-sm">
                <item.icon className="h-6 w-6 text-medical-blue-600" />
                <span className="text-gray-700 font-medium">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 lg:py-28">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-heading font-bold text-gray-900 mb-4">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="space-y-6">
            {[
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
            ].map((faq, idx) => (
              <div key={idx} className="bg-gray-50 rounded-xl p-6" data-testid={`faq-item-${idx}`}>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{faq.q}</h3>
                <p className="text-gray-600">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 lg:py-28 bg-medical-blue-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl lg:text-4xl font-heading font-bold text-white mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-xl text-medical-blue-100 mb-8">
            Join thousands of patients and healthcare providers already using VeriHealth.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/portal"
              className="inline-flex items-center justify-center gap-2 bg-white text-medical-blue-600 px-8 py-4 rounded-lg font-semibold hover:bg-gray-100 transition-all"
              data-testid="button-cta-start-free"
            >
              Start Free Trial
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center gap-2 bg-transparent text-white border-2 border-white px-8 py-4 rounded-lg font-semibold hover:bg-white/10 transition-all"
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
