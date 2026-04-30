import Link from "next/link";

const PLANS = [
  {
    name: "Starter",
    price: "R 499",
    period: "/mo",
    color: "var(--cyan-c)",
    description: "Perfect for small teams getting started",
    features: [
      "Up to 3 users",
      "500 leads",
      "Invoicing & quotes",
      "Basic dashboard",
      "Email support",
    ],
    cta: "Start free trial",
    href: "/signup",
    highlight: false,
  },
  {
    name: "Pro",
    price: "R 1 499",
    period: "/mo",
    color: "var(--accent)",
    description: "For growing businesses that need more power",
    features: [
      "Up to 15 users",
      "Unlimited leads",
      "Full accounting suite",
      "Custom KPIs & dashboards",
      "Bank reconciliation",
      "Marketing campaigns",
      "Priority support",
    ],
    cta: "Start free trial",
    href: "/signup",
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    color: "var(--purple-c)",
    description: "White-label or multi-tenant deployments",
    features: [
      "Unlimited users & orgs",
      "White-label branding",
      "Custom integrations",
      "Dedicated instance",
      "SLA guarantee",
      "Onboarding & training",
    ],
    cta: "Contact us",
    href: "mailto:corpCoco70@gmail.com",
    highlight: false,
  },
];

export default function PricingPage() {
  return (
    <main className="min-h-screen py-16 px-4" style={{ background: "var(--background)" }}>
      {/* Header */}
      <div className="text-center mb-14 max-w-2xl mx-auto">
        <Link href="/login" className="inline-flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, var(--pink) 0%, var(--accent) 100%)" }}>
            <span className="text-white font-bold text-sm">C</span>
          </div>
          <span className="text-lg font-bold tracking-widest">
            <span style={{ color: "var(--pink)" }}>COCO</span>
            <span style={{ color: "var(--foreground)" }}>CORP</span>
          </span>
        </Link>
        <h1 className="text-4xl font-bold mb-4">Simple, transparent pricing</h1>
        <p className="text-lg" style={{ color: "var(--muted2)" }}>
          One platform for leads, invoicing, accounting, and marketing.
          Start free, upgrade when you&apos;re ready.
        </p>
      </div>

      {/* Plans grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {PLANS.map(plan => (
          <div key={plan.name}
            className="rounded-2xl p-6 flex flex-col relative"
            style={{
              background: plan.highlight ? "var(--card2)" : "var(--card)",
              border: `2px solid ${plan.highlight ? plan.color : "var(--border)"}`,
              boxShadow: plan.highlight ? `0 0 40px ${plan.color}22` : "none",
            }}>
            {plan.highlight && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-bold"
                style={{ background: plan.color, color: "#fff" }}>
                Most Popular
              </div>
            )}
            <div className="mb-5">
              <h2 className="text-lg font-bold mb-1" style={{ color: plan.color }}>{plan.name}</h2>
              <div className="flex items-end gap-1">
                <span className="text-3xl font-bold">{plan.price}</span>
                <span className="text-sm pb-1" style={{ color: "var(--muted2)" }}>{plan.period}</span>
              </div>
              <p className="text-sm mt-2" style={{ color: "var(--muted2)" }}>{plan.description}</p>
            </div>
            <ul className="space-y-2.5 flex-1 mb-6">
              {plan.features.map(f => (
                <li key={f} className="flex items-center gap-2 text-sm">
                  <span style={{ color: plan.color }}>✓</span>
                  <span style={{ color: "var(--muted)" }}>{f}</span>
                </li>
              ))}
            </ul>
            <Link href={plan.href}
              className="block w-full py-3 rounded-xl text-sm font-bold text-center transition-opacity hover:opacity-80"
              style={{
                background: plan.highlight ? plan.color : "var(--card2)",
                color: plan.highlight ? "#fff" : plan.color,
                border: `1px solid ${plan.color}`,
              }}>
              {plan.cta}
            </Link>
          </div>
        ))}
      </div>

      {/* Footnote */}
      <p className="text-center text-sm mt-12" style={{ color: "var(--muted2)" }}>
        All plans include a 14-day free trial. No credit card required. ·{" "}
        <Link href="/login" style={{ color: "var(--accent)" }}>Sign in</Link>
      </p>
    </main>
  );
}
