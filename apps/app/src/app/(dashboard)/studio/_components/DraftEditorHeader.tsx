import { ArrowLeft, Check, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CustomLink } from "@/components/ui/custom-link";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import UndoRedoControls from "./UndoRedoControls";

interface DraftEditorHeaderProps {
	isSidebarOpen: boolean;
	canUndo: boolean;
	canRedo: boolean;
	onUndo: () => void;
	onRedo: () => void;
	onSave: () => void;
	status: "idle" | "saving" | "success" | "error";
	hasDraftId: boolean;
	onSaveAsTemplate: () => void;
	onDeleteDraft: () => void;
	isOverLimit?: boolean;
	backHref: string;
	onBack?: () => void;
}

export function DraftEditorHeader({
	isSidebarOpen,
	canUndo,
	canRedo,
	onUndo,
	onRedo,
	onSave,
	status,
	hasDraftId,
	onSaveAsTemplate,
	onDeleteDraft,
	isOverLimit = false,
	backHref,
	onBack,
}: DraftEditorHeaderProps) {
	return (
		<header
			className={cn(
				"flex items-center justify-between border-b border-neutral-100 px-6 py-4 transition-all duration-300",
				!isSidebarOpen && "md:pl-16",
			)}
		>
			<div className="flex items-center gap-4">
				{onBack ? (
					<button
						type="button"
						onClick={onBack}
						className="text-neutral-500 hover:text-neutral-900 -ml-2 gap-1.5 cursor-pointer inline-flex items-center text-sm font-medium"
					>
						<ArrowLeft aria-hidden="true" className="w-4 h-4" />
						{hasDraftId ? "Back" : "Cancel"}
					</button>
				) : (
					<CustomLink
						href={backHref}
						className="text-neutral-500 hover:text-neutral-900 -ml-2 gap-1.5 cursor-pointer inline-flex items-center text-sm font-medium"
					>
						<ArrowLeft className="w-4 h-4" aria-hidden="true" />
						{hasDraftId ? "Back" : "Cancel"}
					</CustomLink>
				)}
			</div>

			<div className="flex items-center gap-4">
				<UndoRedoControls
					canUndo={canUndo}
					canRedo={canRedo}
					onUndo={onUndo}
					onRedo={onRedo}
				/>

				<Button
					onClick={onSave}
					disabled={status === "saving" || status === "success" || isOverLimit}
					size="sm"
					className="w-24 rounded-full"
					type="button"
				>
					{status === "saving" ? (
						"Saving..."
					) : status === "success" ? (
						<span className="flex items-center gap-1">
							<Check className="w-4 h-4 text-note-info" aria-hidden="true" />
							Saved
						</span>
					) : (
						"Save"
					)}
				</Button>

				<Popover>
					<PopoverTrigger
						render={
							<Button
								type="button"
								variant="ghost"
								size="icon"
								className="text-neutral-400 hover:text-neutral-900 cursor-pointer"
								aria-label="More options"
							>
								<MoreHorizontal
									className="size-5 md:size-4"
									aria-hidden="true"
								/>
							</Button>
						}
					/>
					<PopoverContent align="end" className="w-48 p-2">
						<div className="flex flex-col gap-1">
							<Button
								type="button"
								variant="ghost"
								className="w-full justify-start text-sm font-medium text-neutral-600 hover:text-action cursor-pointer"
								onClick={onSaveAsTemplate}
							>
								Save as Template
							</Button>
							{hasDraftId && (
								<Button
									type="button"
									variant="ghost"
									className="w-full justify-start text-sm font-medium text-note-alert hover:bg-note-alert/10 cursor-pointer"
									onClick={onDeleteDraft}
								>
									Delete Draft
								</Button>
							)}
						</div>
					</PopoverContent>
				</Popover>
			</div>
		</header>
	);
}
