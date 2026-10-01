/** Marks sample data (sample-data.ts) so nobody reads it as real. */
export function SampleTag() {
  return (
    <span className="ov-sample" title="Sample data: the real figure arrives with its screen (docs/TODO.md)">
      Sample
    </span>
  );
}
