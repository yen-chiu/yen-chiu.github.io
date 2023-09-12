import { basic, initSidebar, initTopbar } from './modules/layouts';
import {
  highlightLines,
  runCpp,
  runJavascript,
  runPython,
  runRust,
  imgLazy,
  imgPopup,
  initLocaleDatetime,
  initClipboard,
  toc
} from './modules/plugins';

basic();
highlightLines();
runCpp();
runJavascript();
runPython();
runRust();
initSidebar();
initTopbar();
imgLazy();
imgPopup();
initLocaleDatetime();
initClipboard();
toc();
