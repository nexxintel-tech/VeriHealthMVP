import { Link } from "wouter";

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-primary">VeriHealth</p>
            <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground">
              Terms of Service
            </h1>
          </div>
          <Link href="/login" className="text-sm text-primary hover:underline">
            Back to login
          </Link>
        </div>

        <div className="space-y-6 text-sm leading-7 text-muted-foreground">
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Use of the service</h2>
            <p>
              VeriHealth supports remote patient monitoring, patient engagement, and care-team
              coordination. The service must be used only for lawful healthcare and personal health
              management purposes.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Account responsibility</h2>
            <p>
              You are responsible for the accuracy of information submitted under your account and
              for keeping your credentials confidential. Accounts must not be shared between users.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Clinical use limits</h2>
            <p>
              VeriHealth helps with monitoring and coordination, but it does not replace emergency
              services or independent clinical judgment. Urgent medical decisions must go through
              proper care channels.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Service changes</h2>
            <p>
              Access may be updated, limited, or suspended when necessary to protect users,
              maintain security, or meet legal and regulatory obligations.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
