import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { mergeAttributes } from "@tiptap/core";
import { ImageWithCaption } from "./ImageWithCaption";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import { common, createLowlight } from "lowlight";
import { ImagePaste } from "./ImagePaste";
import { ListKeymap } from "./ListKeymap";
import type { Extensions } from "@tiptap/core";

const lowlight = createLowlight(common);

interface ExtensionOptions {
  onImagePaste: (base64: string, fileName: string) => void;
  onLinkClick: (href: string) => void;
  onDeleteImage: (imagePath: string) => void;
  onOpenImage: (imagePath: string) => void;
}

export function createExtensions({
  onImagePaste,
  onLinkClick,
  onDeleteImage,
  onOpenImage,
}: ExtensionOptions): Extensions {
  return [
    StarterKit.configure({
      codeBlock: false,
    }),
    CodeBlockLowlight.configure({
      lowlight,
      HTMLAttributes: {
        class: "livemark-code-block",
      },
    }),
    Link.extend({
      // Render the URL in data-href instead of href so the
      // VS Code webview doesn't intercept clicks and open them externally.
      renderHTML({ HTMLAttributes }) {
        const { href, ...rest } = HTMLAttributes;
        return [
          "a",
          mergeAttributes(rest, { "data-href": href }),
          0,
        ];
      },
    }).configure({
      openOnClick: false,
      autolink: true,
      HTMLAttributes: {
        class: "livemark-link",
      },
    }),
    ImageWithCaption.configure({
      HTMLAttributes: {
        class: "livemark-image",
      },
      onDeleteImage,
      onOpenImage,
    }),
    TaskList,
    TaskItem.configure({
      nested: true,
    }),
    Placeholder.configure({
      placeholder: "Start writing...",
    }),
    Typography,
    Table.configure({
      resizable: false,
      HTMLAttributes: { class: "livemark-table" },
    }),
    TableRow,
    TableHeader,
    TableCell,
    ImagePaste.configure({
      onImagePaste,
    }),
    ListKeymap,
  ];
}
