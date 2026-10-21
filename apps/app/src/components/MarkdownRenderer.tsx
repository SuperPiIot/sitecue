"use client";

import { ExternalLink, WrapText } from "lucide-react";
import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { InlineCopyButton } from "@/components/ui/inline-copy-button";
import { cn } from "@/lib/utils";
import "highlight.js/styles/github.css";

// Make sure to add highlight.js theme in globals.css or here
// import "highlight.js/styles/github-dark.css";

// Helper to extract text from React nodes (recursively)
const extractText = (node: React.ReactNode): string => {
	if (typeof node === "string" || typeof node === "number") {
		return String(node);
	}
	if (Array.isArray(node)) {
		return node.map(extractText).join("");
	}
	if (React.isValidElement(node)) {
		return extractText((node.props as { children?: React.ReactNode }).children);
	}
	return "";
};

const ensureAbsoluteUrl = (url: string | undefined): string | undefined => {
	if (!url) return url;
	if (
		url.startsWith("http://") ||
		url.startsWith("https://") ||
		url.startsWith("mailto:") ||
		url.startsWith("tel:") ||
		url.startsWith("/") ||
		url.startsWith("#")
	) {
		return url;
	}
	return `https://${url}`;
};

interface CodeBlockNodeProps {
	children: React.ReactNode;
	className?: string;
	codeString: string;
}

function CodeBlockNode({
	children,
	className,
	codeString,
}: CodeBlockNodeProps) {
	const [isWrapped, setIsWrapped] = useState(false);

	return (
		<div className="relative group my-4 not-prose min-w-0 w-full max-w-full">
			<div className="absolute top-2 right-2 z-[1] flex items-center gap-1 opacity-100 pointer-fine:opacity-0 group-hover-safe:opacity-100 transition-opacity duration-200">
				<button
					type="button"
					onClick={() => setIsWrapped(!isWrapped)}
					className="p-1.5 rounded-md bg-base-surface/80 dark:bg-neutral-800/80 backdrop-blur-sm border border-base-border dark:border-neutral-700 text-gray-500 hover:text-action dark:hover:text-neutral-100 transition-colors cursor-pointer flex items-center justify-center"
					title={isWrapped ? "Disable wrap" : "Wrap text"}
				>
					<WrapText className="w-3.5 h-3.5" aria-hidden="true" />
				</button>
				<InlineCopyButton
					text={codeString}
					className="bg-base-surface/80 dark:bg-neutral-800/80 backdrop-blur-sm border border-base-border dark:border-neutral-700 text-gray-500 hover:text-action dark:hover:text-neutral-100"
				/>
			</div>
			{/* codeblock */}
			<pre
				className={cn(
					"overflow-x-auto rounded-xl bg-base-bg dark:bg-neutral-900 border border-base-border dark:border-neutral-800 p-4 text-xs md:text-sm font-mono leading-relaxed transition-all duration-200 w-full max-w-full min-w-0",
					isWrapped && "whitespace-pre-wrap break-all",
				)}
			>
				<code className={className}>{children}</code>
			</pre>
		</div>
	);
}

interface MarkdownRendererProps {
	content: string;
	className?: string;
}

export default function MarkdownRenderer({
	content,
	className = "",
}: MarkdownRendererProps) {
	return (
		<div
			className={cn(
				"prose prose-sm md:prose-base dark:prose-invert max-w-none wrap-break-word",
				className,
			)}
		>
			<ReactMarkdown
				remarkPlugins={[remarkGfm, remarkBreaks]}
				rehypePlugins={[rehypeHighlight]}
				components={{
					// Link Styling - Force external new tab
					a: ({ href, children }) => {
						const safeHref = ensureAbsoluteUrl(href);
						return (
							<a
								href={safeHref}
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex items-center gap-1 text-action font-medium underline underline-offset-4 hover:text-action-hover transition-colors"
							>
								{children}
								<ExternalLink className="w-3 h-3" aria-hidden="true" />
							</a>
						);
					},
					// Code Styling
					code(props) {
						const { children, className, node, ...rest } = props;
						const match = /language-(\w+)/.exec(className || "");
						const isBlock = match || String(children).includes("\n");

						if (!isBlock) {
							return (
								<code
									{...rest}
									className="px-1.5 py-0.5 bg-base-surface dark:bg-neutral-800 text-action dark:text-neutral-100 rounded font-mono text-[0.85em] before:content-none after:content-none"
								>
									{children}
								</code>
							);
						}

						// Block Code
						const rawText = extractText(children);
						const codeString = rawText.replace(/\n$/, "");

						return (
							<CodeBlockNode className={className} codeString={codeString}>
								{children}
							</CodeBlockNode>
						);
					},
					// Checkbox styling (remark-gfm)
					input: (props) => {
						if (props.type === "checkbox") {
							return (
								<input
									type="checkbox"
									checked={props.checked}
									readOnly
									className="w-4 h-4 rounded border-base-border text-action focus:ring-action mr-2"
								/>
							);
						}
						return <input {...props} />;
					},
				}}
			>
				{content}
			</ReactMarkdown>
		</div>
	);
}
