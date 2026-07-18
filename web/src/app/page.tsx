import Link from 'next/link';
import Image from 'next/image';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-background relative overflow-hidden">
      {/* Decorative Gold Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="z-10 w-full max-w-5xl items-center justify-center text-center font-mono text-sm flex flex-col gap-8">
        
        <div className="flex items-center justify-center gap-4">
          <Image 
            src="/logo.png" 
            alt="Lakzee Fitness Studio Logo" 
            width={128}
            height={128}
            priority
            className="w-24 h-24 md:w-32 md:h-32 object-cover rounded-full bg-white shadow-2xl" 
          />
          <h1 className="text-4xl md:text-6xl font-heading font-extrabold tracking-tight">
            LAKZEE <span className="gold-gradient-text">FITNESS</span>
          </h1>
        </div>

        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl font-body">
          Enterprise Gym Membership Management Platform
        </p>

        <div className="flex gap-4 mt-8">
          <Link
            href="/login"
            className="px-8 py-4 rounded-xl bg-primary text-primary-foreground font-semibold text-lg transition-all hover:bg-accent-hover hover:scale-105 shadow-[0_0_20px_rgba(212,175,55,0.3)]"
          >
            Access Dashboard
          </Link>
          <Link
            href="/member"
            className="px-8 py-4 rounded-xl glass text-foreground font-semibold text-lg transition-all hover:bg-white/10"
          >
            Member Portal
          </Link>
        </div>

      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "LocalBusiness",
            "name": "Lakzee Fitness Studio",
            "image": "https://lakzeefitness.com/logo.png",
            "url": "https://lakzeefitness.com",
            "telephone": "+1234567890",
            "description": "Enterprise Gym Membership Management Platform",
            "address": {
              "@type": "PostalAddress",
              "streetAddress": "Main Street",
              "addressLocality": "City",
              "addressRegion": "State",
              "postalCode": "12345",
              "addressCountry": "US"
            }
          })
        }}
      />
    </main>
  );
}
