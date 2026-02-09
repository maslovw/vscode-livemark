import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

export interface ImagePasteOptions {
  onImagePaste: (base64: string, fileName: string) => void;
}

export const ImagePaste = Extension.create<ImagePasteOptions>({
  name: "imagePaste",

  addOptions() {
    return {
      onImagePaste: () => {},
    };
  },

  addProseMirrorPlugins() {
    const { onImagePaste } = this.options;

    return [
      new Plugin({
        key: new PluginKey("imagePaste"),
        props: {
          handlePaste(view, event) {
            const items = event.clipboardData?.items;
            if (!items) return false;

            for (const item of Array.from(items)) {
              if (item.type.startsWith("image/")) {
                event.preventDefault();
                const file = item.getAsFile();
                if (!file) continue;

                const reader = new FileReader();
                reader.onload = () => {
                  const result = reader.result as string;
                  // Strip data URL prefix
                  const base64 = result.split(",")[1];
                  const ext = file.type.split("/")[1] || "png";
                  const fileName = `paste.${ext}`;
                  onImagePaste(base64, fileName);
                };
                reader.readAsDataURL(file);
                return true;
              }
            }
            return false;
          },

          handleDrop(view, event) {
            const files = event.dataTransfer?.files;
            if (!files || files.length === 0) return false;

            for (const file of Array.from(files)) {
              if (file.type.startsWith("image/")) {
                event.preventDefault();
                const reader = new FileReader();
                reader.onload = () => {
                  const result = reader.result as string;
                  const base64 = result.split(",")[1];
                  onImagePaste(base64, file.name);
                };
                reader.readAsDataURL(file);
                return true;
              }
            }
            return false;
          },
        },
      }),
    ];
  },
});
