import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";
import { ImagePaste } from "./ImagePaste";
import { ListKeymap } from "./ListKeymap";
import type { Extensions } from "@tiptap/core";

const lowlight = createLowlight(common);

interface ExtensionOptions {
  onImagePaste: (base64: string, fileName: string) => void;
  onLinkClick: (href: string) => void;
}

export function createExtensions({
  onImagePaste,
  onLinkClick,
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
    Link.configure({
      openOnClick: false,
      autolink: true,
      HTMLAttributes: {
        class: "livemark-link",
      },
    }),
    Image.configure({
      HTMLAttributes: {
        class: "livemark-image",
      },
    }),
    TaskList,
    TaskItem.configure({
      nested: true,
    }),
    Placeholder.configure({
      placeholder: "Start writing...",
    }),
    Typography,
    ImagePaste.configure({
      onImagePaste,
    }),
    ListKeymap,
  ];
}
