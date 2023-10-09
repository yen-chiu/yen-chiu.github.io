import { basic, initSidebar, initTopbar } from './modules/layouts';
import {
  loadImg,
  imgPopup,
  initLocaleDatetime,
  initClipboard,
  toc
} from './modules/plugins';

import {
  highlightLines,
  runCpp,
  runJavascript,
  runPython,
  runRust,
} from './modules/plugins';

highlightLines();
runCpp();
runJavascript();
runPython();
runRust();

initSidebar();
initTopbar();
loadImg();
imgPopup();
initLocaleDatetime();
initClipboard();
toc();
basic();


