import Image from "next/image";
import Link from "next/link";

import type { PostPreview } from "@/domain/catalog";

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function PostCard({ post }: { post: PostPreview }) {
  return (
    <article className="min-w-0 overflow-hidden rounded-ui border border-line bg-white">
      <Link aria-label={post.title} className="relative block aspect-[16/10]" href={post.href}><Image alt={post.image.alt} className="object-cover" fill sizes="(min-width:1200px) 25vw, (min-width:768px) 50vw, 85vw" src={post.image.url} /></Link>
      <div className="p-4">
        <span className="rounded-badge bg-surface-2 px-2 py-0.5 text-badge font-bold text-ink">{post.category}</span>
        <h3 className="mt-2 line-clamp-2 text-body font-bold text-ink"><Link href={post.href}>{post.title}</Link></h3>
        <p className="mt-1 line-clamp-2 text-meta text-ink-2">{post.excerpt}</p>
        <time className="mt-3 block text-meta text-muted" dateTime={post.publishedAt}>{dateFormatter.format(new Date(`${post.publishedAt}T00:00:00`))}</time>
      </div>
    </article>
  );
}
