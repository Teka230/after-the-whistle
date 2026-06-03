import type { ReactNode } from "react";
import { APP_NAME, APP_TAGLINE } from "@after-the-whistle/core/branding";
import { WhistleMark } from "./WhistleMark.js";

interface Props {
  sport?: string;
  scoreLine?: ReactNode;
}

export function BrandHeader({ sport, scoreLine }: Props) {
  return (
    <header className="atw-brand-block">
      <div className="atw-brand-row">
        <WhistleMark size={32} className="atw-mark" />
        <div className="atw-brand-copy">
          <h1 className="atw-title">{APP_NAME}</h1>
          <p className="atw-tagline">{APP_TAGLINE}</p>
        </div>
      </div>
      {(sport || scoreLine) && (
        <div className="atw-match-row">
          {sport ? <span className="atw-badge">{sport}</span> : null}
          {scoreLine ? <span className="atw-score">{scoreLine}</span> : null}
        </div>
      )}
    </header>
  );
}
