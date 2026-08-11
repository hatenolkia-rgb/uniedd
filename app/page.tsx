import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import Features from "./components/Features";
import MusicJourney from "./components/MusicJourney";
import Courses from "./components/Courses";
import Parallax from "./components/Parallax";
import LearnPlay from "./components/LearnPlay";
import Pricing from "./components/Pricing";
import StatsBand from "./components/StatsBand";
import Testimonials from "./components/Testimonials";
import CTA from "./components/CTA";
import Footer from "./components/Footer";

export default function Home() {
  return (
    <main>
      <Navbar />
      <Hero />
      <Features />
      <MusicJourney />
      <Parallax />
      <Courses />
      <StatsBand />
      <LearnPlay />
      <Pricing />
      <Testimonials />
      <CTA />
      <Footer />
    </main>
  );
}
