import { computed } from "vue";
import { useConfig } from "./useConfig";
import useTab from "./useTab";

// 从文件路径获取文件名
function getFileNameFromPath(filePath: string | null): string {
  if (!filePath) return "Untitled";
  const parts = filePath.split(/[\\/]/);
  return parts.at(-1) ?? "Untitled";
}

export default function useRecentFiles() {
  const { config, setConf } = useConfig();
  const { openFile } = useTab();

  const recentFilesConfig = computed(() => config.value.recentFiles);

  const recentFiles = computed(() => {
    if (!recentFilesConfig.value.enabled) return [];
    // 按最后打开时间排序，最新的在前
    return [...recentFilesConfig.value.files]
      .sort((a, b) => b.lastOpened - a.lastOpened)
      .map((file) => ({
        ...file,
        // 确保文件名总是正确的，从路径获取
        name: getFileNameFromPath(file.path),
      }));
  });

  function addRecentFile(filePath: string, fileName?: string) {
    if (!recentFilesConfig.value.enabled) return;

    // 检查文件是否已存在
    const existingIndex = recentFilesConfig.value.files.findIndex(
      (f) => f.path === filePath
    );

    let newFiles = [...recentFilesConfig.value.files];

    // 从路径获取文件名，更可靠
    const name = fileName || getFileNameFromPath(filePath);

    if (existingIndex !== -1) {
      // 如果已存在，更新时间并移到最前面
      const existingFile = newFiles.splice(existingIndex, 1)[0];
      existingFile.lastOpened = Date.now();
      existingFile.name = name; // 更新一下文件名
      newFiles.unshift(existingFile);
    } else {
      // 如果不存在，添加到最前面
      newFiles.unshift({
        path: filePath,
        name: name,
        lastOpened: Date.now(),
      });
    }

    // 限制最大数量
    if (newFiles.length > recentFilesConfig.value.maxFiles) {
      newFiles = newFiles.slice(0, recentFilesConfig.value.maxFiles);
    }

    setConf("recentFiles", {
      ...recentFilesConfig.value,
      files: newFiles,
    });
  }

  function openRecentFile(filePath: string) {
    openFile(filePath);
  }

  function clearRecentFiles() {
    setConf("recentFiles", {
      ...recentFilesConfig.value,
      files: [],
    });
  }

  function removeRecentFile(filePath: string) {
    const newFiles = recentFilesConfig.value.files.filter((f) => f.path !== filePath);
    setConf("recentFiles", {
      ...recentFilesConfig.value,
      files: newFiles,
    });
  }

  return {
    recentFiles,
    recentFilesConfig,
    addRecentFile,
    openRecentFile,
    clearRecentFiles,
    removeRecentFile,
  };
}
