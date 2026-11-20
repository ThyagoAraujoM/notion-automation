import { Features } from "./_components/features";
import { Footer } from "./_components/footer";
import { Hero } from "./_components/hero";
import { HowItWorks } from "./_components/how-it-works";
import { Routes } from "./_components/routes";
import { Stack } from "./_components/stack";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-20 px-4 py-12 sm:px-6 sm:py-20">
      <Hero />
      <Features />
      <Routes />
      <HowItWorks />
      <Stack />
      <Footer />
    </main>
  );
}
