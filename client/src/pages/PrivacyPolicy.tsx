import { Link } from "wouter";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-primary">VeriHealth</p>
            <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground">
              Privacy Policy
            </h1>
          </div>
          <Link href="/login" className="text-sm text-primary hover:underline">
            Back to login
          </Link>
        </div>

        <div className="space-y-6 text-sm leading-7 text-muted-foreground">
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Information we collect</h2>
            <p>
              VeriHealth stores account details, profile information, care relationships, and
              health monitoring data needed to operate remote patient monitoring workflows.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">How data is used</h2>
            <p>
              Your data is used to authenticate access, power dashboards, generate alerts, and
              support communication between patients, clinicians, and administrators.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Access control</h2>
            <p>
              Access is restricted by role and institutional permissions. Administrative actions
              and sensitive account changes may be logged for security and audit purposes.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Retention and security</h2>
            <p>
              VeriHealth applies authentication, transport security, and operational controls to
              protect sensitive data. Records are retained according to operational and regulatory
              requirements.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
