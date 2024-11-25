/**
 * 将月份/日期更新为本地日期时间
 *
 * 要求：<https://github.com/iamkun/dayjs>
 */

/* 本地日期时间工具 */
class LocaleHelper {
  static get attrTimestamp() {
    return 'data-ts';
  }

  static get attrDateFormat() {
    return 'data-df';
  }

  static get locale() {
    return document.documentElement.getAttribute('lang').substring(0, 2);
  }

  static getTimestamp(elem) {
    return Number(elem.getAttribute(this.attrTimestamp)); // unix 时间戳
  }

  static getDateFormat(elem) {
    return elem.getAttribute(this.attrDateFormat);
  }
}

export function initLocaleDatetime() {
  dayjs.locale(LocaleHelper.locale);
  dayjs.extend(window.dayjs_plugin_localizedFormat);

  document
    .querySelectorAll(`[${LocaleHelper.attrTimestamp}]`)
    .forEach((elem) => {
      const date = dayjs.unix(LocaleHelper.getTimestamp(elem));
      const text = date.format(LocaleHelper.getDateFormat(elem));
      elem.textContent = text;
      elem.removeAttribute(LocaleHelper.attrTimestamp);
      elem.removeAttribute(LocaleHelper.attrDateFormat);

      // 设置工具提示
      if (
        elem.hasAttribute('data-bs-toggle') &&
        elem.getAttribute('data-bs-toggle') === 'tooltip'
      ) {
        // 参见：https://day.js.org/docs/en/display/format#list-of-localized-formats
        const tooltipText = date.format('llll');
        elem.setAttribute('data-bs-title', tooltipText);
      }
    });
}
