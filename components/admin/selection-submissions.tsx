export type AdminSubmission = {
  id: string;
  status: "submitted";
  photoCount: number;
  submittedAt: string;
  photos: { id: string; filename: string; previewUrl: string | null }[];
};

function formatSubmittedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return date.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export function SelectionSubmissions({ submissions }: { submissions: AdminSubmission[] }) {
  if (!submissions.length) {
    return <p className="empty">No selection has been submitted yet.</p>;
  }
  return (
    <ul className="selection-submission-list">
      {submissions.map(submission => (
        <li className="selection-submission" key={submission.id}>
          <div className="selection-submission-head">
            <strong>Selection submitted</strong>
            <span className="selection-status" aria-label="Submitted">Submitted</span>
            <span className="selection-meta">
              {submission.photoCount} {submission.photoCount === 1 ? "photo" : "photos"} · Submitted {formatSubmittedAt(submission.submittedAt)}
            </span>
          </div>
          {submission.photos.length ? (
            <div className="selection-submission-photos">
              {submission.photos.map(photo => (
                <figure key={photo.id} className="selection-submission-photo" title={photo.filename}>
                  {photo.previewUrl ? (
                    // Signed admin-only URL; click to open the full photograph.
                    <a href={photo.previewUrl} rel="noreferrer" target="_blank">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img alt="" src={photo.previewUrl} />
                    </a>
                  ) : (
                    <span className="photo-card-fallback">Preview unavailable</span>
                  )}
                  <figcaption>{photo.filename}</figcaption>
                </figure>
              ))}
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}