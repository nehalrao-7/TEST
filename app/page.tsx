import { Experience } from "@/components/Experience";
import { brand, sponsors } from "@/lib/brand";

export default function Home() {
  return (
    <>
      <header className="header">
        <a href="#" className="header__logo" aria-label={`${brand.event} home`}>
          {brand.name}
        </a>
        <nav className="header__nav" aria-label="Main">
          <span className="header__link header__link--soon">
            Shop <em>Soon</em>
          </span>
          <a className="header__link" href="#partners">
            Partners
          </a>
        </nav>
      </header>

      <main>
        <Experience />

        <section id="partners" className="partners">
          <p className="eyebrow">
            <span className="dot" /> Official partners
          </p>
          <h2 className="display display--md">On the floor with us.</h2>
          <ul className="partners__grid">
            {sponsors.map((s) => (
              <li key={s.name} className="partners__item">
                {s.logo ? (
                  <img src={s.logo} alt={s.name} />
                ) : (
                  <span>{s.name}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="footer">
        <span>{brand.event}</span>
        <span>© {new Date().getFullYear()}</span>
      </footer>
    </>
  );
}
