// 首先导入 mock，确保在任何其他模块加载之前设置好 window.electronAPI
import "./electron-mock";
import "../../lang/index.js";
import { createApp } from "vue";
import { directives } from "@/directives";
import App from "./App.vue";
import "./style.less";
import "@/themes/theme-main.less";
import "vditor/src/assets/less/index.less";

const app = createApp(App);

Object.entries(directives).forEach(([name, directive]) => {
  app.directive(name, directive);
});

app.mount("#app");
