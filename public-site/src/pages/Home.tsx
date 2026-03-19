import { Link } from 'wouter';
import { Activity, Shield, Zap, Clock, ArrowRight } from 'lucide-react';

export default function Home() {
  const features = [
    { icon: Activity, title: 'Real-Time Monitoring', description: 'Track vital signs continuously with AI-powered alerts.' },
    { icon: Shield, title: 'HIPAA Compliant', description: 'Enterprise-grade security ensuring patient data protection.' },
    { icon: Zap, title: 'AI Risk Scoring', description: 'Predict patient deterioration before it happens.' },
    { icon: Clock, title: '24/7 Support', description: 'Round-the-clock technical support and clinical guidance.' },
  ];

  const stats = [
    { value: '10K+', label: 'Patients Monitored' },
    { value: '500+', label: 'Healthcare Providers' },
    { value: '99.9%', label: 'System Uptime' },
    { value: '40%', label: 'Reduced Readmissions' },
  ];

  return (
    <div className="bg-white min-h-screen text-slate-800">
      <section className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white p-12 text-center">
        <h1 className="text-3xl md:text-5xl font-bold">VeriHealth</h1>
        <p className="mt-2 max-w-2xl mx-auto text-base md:text-lg">
          Secure remote monitoring and clinician support.
        </p>
      </section>

      <section className="py-10 max-w-6xl mx-auto px-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, i) => (
            <div key={i} className="rounded-xl border p-4 text-center">
              <div className="text-3xl font-bold text-blue-700">{stat.value}</div>
              <div className="text-sm text-gray-600">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="py-10 max-w-6xl mx-auto px-4">
        <h2 className="text-2xl font-bold mb-4">Why Choose VeriHealth?</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((feature, i) => (
            <div key={i} className="border rounded-xl p-4">
              <feature.icon className="h-6 w-6 text-blue-600 mb-2" />
              <h3 className="font-semibold">{feature.title}</h3>
              <p className="text-sm text-gray-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="py-10 text-center">
        <div className="flex justify-center gap-3">
          <Link href="/contact">
            <button className="px-5 py-2 bg-blue-600 text-white rounded">Schedule a Demo</button>
          </Link>
          <Link href="/portal">
            <button className="px-5 py-2 border border-blue-600 text-blue-600 rounded">Clinician Login</button>
          </Link>
        </div>
      </section>
    </div>
  );
}