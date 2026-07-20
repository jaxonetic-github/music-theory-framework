import "music-theory-framework/web/styles.css";

export const metadata = { title: "Music Theory Embed Fixture" };

export default function RootLayout({ children }) {
    return <html lang="en"><body><p className="host-copy">Host content</p>{children}</body></html>;
}
