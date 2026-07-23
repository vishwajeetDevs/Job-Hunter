import type {
  OptimizedResumeContent,
  OptimizedResumeEntry,
} from "@/features/studio/types";

function EntrySection({
  title,
  entries,
}: {
  title: string;
  entries: OptimizedResumeEntry[];
}) {
  if (entries.length === 0) return null;

  return (
    <div>
      <h4 className="border-b border-border/60 pb-1 text-xs font-bold uppercase tracking-wider">
        {title}
      </h4>
      <div className="mt-2 space-y-3">
        {entries.map((entry, index) => (
          <div key={`${entry.heading}-${index}`}>
            <p className="text-sm font-semibold leading-snug">
              {entry.heading}
              {entry.subheading && (
                <span className="font-normal text-muted-foreground">
                  {" "}
                  — {entry.subheading}
                </span>
              )}
            </p>
            {entry.period && (
              <p className="text-xs text-muted-foreground">{entry.period}</p>
            )}
            {entry.bullets.length > 0 && (
              <ul className="mt-1 list-disc space-y-1 pl-4">
                {entry.bullets.map((bullet) => (
                  <li key={bullet} className="text-sm text-muted-foreground">
                    {bullet}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

type OptimizedResumePreviewProps = {
  content: OptimizedResumeContent;
};

/** Document-style preview of AI-generated resume content. */
export function OptimizedResumePreview({ content }: OptimizedResumePreviewProps) {
  return (
    <div className="space-y-4">
      <div>
        {content.name && (
          <p className="text-lg font-bold leading-tight">{content.name}</p>
        )}
        {content.headline && (
          <p className="text-sm text-muted-foreground">{content.headline}</p>
        )}
        {content.contact && (
          <p className="mt-0.5 text-xs text-muted-foreground">{content.contact}</p>
        )}
      </div>

      {content.summary && (
        <div>
          <h4 className="border-b border-border/60 pb-1 text-xs font-bold uppercase tracking-wider">
            Summary
          </h4>
          <p className="mt-2 text-sm text-muted-foreground">{content.summary}</p>
        </div>
      )}

      {content.skills.length > 0 && (
        <div>
          <h4 className="border-b border-border/60 pb-1 text-xs font-bold uppercase tracking-wider">
            Skills
          </h4>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {content.skills.map((skill) => (
              <span
                key={skill}
                className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      <EntrySection title="Experience" entries={content.experience} />
      <EntrySection title="Projects" entries={content.projects} />
      <EntrySection title="Education" entries={content.education} />
      <EntrySection title="Certifications" entries={content.certifications ?? []} />
      <EntrySection title="Achievements" entries={content.achievements ?? []} />
    </div>
  );
}
