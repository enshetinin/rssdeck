export default function HomePage() {
  return (
    <div className="yev-frame shell-layout">
      <p className="shell-context yev-meta">Private RSS and Atom dashboard</p>
      <section className="empty-state yev-stack" aria-labelledby="entries-heading">
        <h1 id="entries-heading">All entries</h1>
        <p>
          No entries yet. Entries appear here once you subscribe to a feed and it has been fetched.
        </p>
      </section>
    </div>
  );
}
