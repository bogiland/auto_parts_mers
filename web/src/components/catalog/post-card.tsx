import Image from "next/image";
import { ArrowUpRight } from "lucide-react";

import type { PostPreview } from "@/domain/catalog";

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function PostCard({ post }: { post: PostPreview }) {
  return (
    <article className="post-card">
      <a aria-label={post.title} className="post-card__image" href={post.href}>
        <Image alt={post.image.alt} fill sizes="(max-width: 850px) 50vw, 20vw" src={post.image.url} />
      </a>
      <div className="post-card__content">
        <span className="post-card__tag">{post.category}</span>
        <h3><a href={post.href}>{post.title}</a></h3>
        <p>{post.excerpt}</p>
        <div className="post-card__footer">
          <time dateTime={post.publishedAt}>{dateFormatter.format(new Date(`${post.publishedAt}T00:00:00`))}</time>
          <a aria-label={`Открыть: ${post.title}`} href={post.href}><ArrowUpRight size={17} /></a>
        </div>
      </div>
    </article>
  );
}
