import { basic, initSidebar, initTopbar } from './modules/layouts';
import {
  loadImg,
  imgPopup,
  initClipboard,
  highlightLines,
  runCpp,
  runJavascript,
  runPython,
  runRust
} from './modules/plugins';

loadImg();
imgPopup();
initSidebar();
initTopbar();
initClipboard();
basic();
highlightLines();
runCpp();
runJavascript();
runPython();
runRust();
