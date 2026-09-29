import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import Features from "./components/Features";
import MusicJourney from "./components/MusicJourney";
import Courses from "./components/Courses";
import Parallax from "./components/Parallax";
import MeetOurLearners from "./components/MeetOurLearners";
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
      {/* StatsBand (the "7 disciplines / 1:1 / 100% / All ages" strip) is
          hidden for now -- re-import it from ./components/StatsBand to bring
          it back. */}
      <MeetOurLearners />
      <Testimonials />
      <CTA />
      <Footer />
    </main>
  );
}
