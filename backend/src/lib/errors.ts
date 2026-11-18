import type { Request } from "express";

/** Error codes and their Uzbek messages (backend-tz.md §5, plus accounts/eʼlonlar/chat). */
export const ERROR_MESSAGES = {
  VALIDATION_ERROR: "Maʼlumotlar notoʻgʻri",

  // rental request
  DAYS_REQUIRED: "Kunlar sonini kiriting",
  DAYS_NOT_INTEGER: "Kunlar soni butun son boʻlishi kerak",
  DAYS_OUT_OF_RANGE: "Kunlar soni 1 dan 7 gacha boʻlishi kerak",
  NAME_REQUIRED: "Ismni kiriting",
  NAME_TOO_LONG: "Ism 50 belgidan oshmasin",
  NAME_INVALID: "Ismda ruxsat etilmagan belgilar bor",
  TOOL_REQUIRED: "Asbobni tanlang",
  TOOL_NOT_FOUND: "Bunday asbob topilmadi",
  REQUEST_NOT_FOUND: "Soʻrov topilmadi",
  REQUEST_ALREADY_DECIDED: "Bu soʻrovga allaqachon javob berilgan",
  START_DATE_INVALID: "Sanani YYYY-MM-DD koʻrinishida tanlang",
  START_DATE_PAST: "Boshlanish sanasi bugundan oldin boʻlmasin",
  START_DATE_TOO_FAR: "Sana 90 kundan uzoq boʻlmasin",

  // accounts
  FULLNAME_REQUIRED: "Ismingizni kiriting",
  FULLNAME_LENGTH: "Ism 2–50 belgidan iborat boʻlsin",
  USERNAME_REQUIRED: "Foydalanuvchi nomini kiriting",
  USERNAME_INVALID: "3–20 ta lotin harfi, raqam yoki _ belgisi boʻlsin",
  USERNAME_TAKEN: "Bu foydalanuvchi nomi band",
  PASSWORD_REQUIRED: "Parolni kiriting",
  PASSWORD_TOO_SHORT: "Parol kamida 6 belgidan iborat boʻlsin",
  PASSWORD_TOO_LONG: "Parol 100 belgidan oshmasin",
  PASSWORD2_REQUIRED: "Parolni takrorlang",
  PASSWORD_MISMATCH: "Parollar mos kelmadi",
  CURRENT_PASSWORD_WRONG: "Joriy parol notoʻgʻri",
  INVALID_CREDENTIALS: "Foydalanuvchi nomi yoki parol notoʻgʻri",
  USER_BLOCKED: "Hisobingiz bloklangan. Administratorga murojaat qiling",
  UNAUTHORIZED: "Avval tizimga kiring",
  FORBIDDEN: "Bu amal faqat superadmin uchun",
  NOT_OWNER: "Bu eʼlon sizga tegishli emas",
  USER_NOT_FOUND: "Foydalanuvchi topilmadi",
  CANNOT_BLOCK_ADMIN: "Superadminni bloklab boʻlmaydi",

  // eʼlonlar
  TITLE_REQUIRED: "Asbob nomini kiriting",
  TITLE_LENGTH: "Nom 2–40 belgidan iborat boʻlsin",
  DESCRIPTION_REQUIRED: "Qisqa tavsif yozing",
  DESCRIPTION_LENGTH: "Tavsif 5–80 belgidan iborat boʻlsin",
  DETAILS_TOO_LONG: "Batafsil maʼlumot 1000 belgidan oshmasin",
  TEXT_INVALID: "Matnda ruxsat etilmagan belgilar bor",
  PRICE_REQUIRED: "Kunlik narxni kiriting",
  PRICE_NOT_INTEGER: "Narx butun son boʻlsin",
  PRICE_OUT_OF_RANGE: "Narx 1 000 dan 10 000 000 soʻmgacha boʻlsin",
  PHONE_INVALID: "Telefon raqamini +998 XX XXX XX XX koʻrinishida kiriting",
  PHONE_REQUIRED: "Telefon raqamingizni kiriting",
  ICON_INVALID: "Asbob turini tanlang",
  PHOTOS_INVALID: "Rasmlar notoʻgʻri. Qaytadan yuklang",
  PHOTOS_TOO_MANY: "Koʻpi bilan 3 ta rasm",
  PHOTOS_REQUIRED: "Kamida 1 ta rasm yuklang",
  UPLOAD_REQUIRED: "Rasm faylini tanlang",
  UPLOAD_TOO_MANY: "Bir martada koʻpi bilan 3 ta rasm yuklash mumkin",
  UPLOAD_MEDIA_TYPE: "Rasmni multipart/form-data koʻrinishida («images» maydoni) yuboring",
  UPLOAD_IN_USE: "Bu rasm eʼlonga biriktirilgan",
  UPLOAD_NOT_FOUND: "Rasm topilmadi",
  UPLOAD_INVALID: "Faqat JPG, PNG yoki WEBP rasm yuklang",
  UPLOAD_TOO_LARGE: "Rasm hajmi 2 MB dan oshmasin",
  LISTING_NOT_FOUND: "Eʼlon topilmadi",
  ALREADY_REVIEWED: "Bu eʼlon allaqachon koʻrib chiqilgan",
  DECISION_INVALID: "Qarorni tanlang: approve yoki reject",
  REASON_TOO_LONG: "Sabab 200 belgidan oshmasin",
  STATUS_INVALID: "Holat notoʻgʻri",
  DEMO_RESET_DISABLED: "Demo maʼlumotlarni tozalash oʻchirilgan",

  // chat
  MESSAGE_REQUIRED: "Xabar yozing",
  MESSAGE_TOO_LONG: "Xabar 1000 belgidan oshmasin",
  CANNOT_MESSAGE_SELF: "Oʻz eʼloningizga xabar yozib boʻlmaydi",
  CONVERSATION_NOT_FOUND: "Suhbat topilmadi",

  // filters
  DATE_INVALID: "Sana notoʻgʻri",

  // transport
  UNKNOWN_FIELD: "Nomaʼlum maydon",
  INVALID_JSON: "Soʻrov maʼlumotlari notoʻgʻri formatda",
  UNSUPPORTED_MEDIA_TYPE: "Soʻrov JSON formatida boʻlishi kerak",
  PAYLOAD_TOO_LARGE: "Soʻrov hajmi juda katta",
  NOT_FOUND: "Manzil topilmadi",
  RATE_LIMITED: "Juda koʻp soʻrov. Birozdan soʻng qayta urinib koʻring",
  INTERNAL_ERROR: "Serverda xatolik yuz berdi",
} as const;

export type ErrorCode = keyof typeof ERROR_MESSAGES;

/** Russian translations, used when the client sends `Accept-Language: ru`. */
export const ERROR_MESSAGES_RU: Record<ErrorCode, string> = {
  VALIDATION_ERROR: "Неверные данные",
  DAYS_REQUIRED: "Укажите количество дней",
  DAYS_NOT_INTEGER: "Количество дней должно быть целым числом",
  DAYS_OUT_OF_RANGE: "Количество дней — от 1 до 7",
  NAME_REQUIRED: "Введите имя",
  NAME_TOO_LONG: "Имя не длиннее 50 символов",
  NAME_INVALID: "Имя содержит недопустимые символы",
  TOOL_REQUIRED: "Выберите инструмент",
  TOOL_NOT_FOUND: "Инструмент не найден",
  REQUEST_NOT_FOUND: "Заявка не найдена",
  REQUEST_ALREADY_DECIDED: "На эту заявку уже ответили",
  START_DATE_INVALID: "Выберите дату в формате ГГГГ-ММ-ДД",
  START_DATE_PAST: "Дата начала не может быть раньше сегодняшней",
  START_DATE_TOO_FAR: "Дата не дальше чем через 90 дней",
  FULLNAME_REQUIRED: "Введите ваше имя",
  FULLNAME_LENGTH: "Имя — от 2 до 50 символов",
  USERNAME_REQUIRED: "Введите имя пользователя",
  USERNAME_INVALID: "3–20 латинских букв, цифр или _",
  USERNAME_TAKEN: "Это имя пользователя занято",
  PASSWORD_REQUIRED: "Введите пароль",
  PASSWORD_TOO_SHORT: "Пароль — не менее 6 символов",
  PASSWORD_TOO_LONG: "Пароль не длиннее 100 символов",
  PASSWORD2_REQUIRED: "Повторите пароль",
  PASSWORD_MISMATCH: "Пароли не совпадают",
  CURRENT_PASSWORD_WRONG: "Текущий пароль неверный",
  INVALID_CREDENTIALS: "Неверное имя пользователя или пароль",
  USER_BLOCKED: "Ваш аккаунт заблокирован. Обратитесь к администратору",
  UNAUTHORIZED: "Сначала войдите в систему",
  FORBIDDEN: "Действие доступно только суперадмину",
  NOT_OWNER: "Это объявление вам не принадлежит",
  USER_NOT_FOUND: "Пользователь не найден",
  CANNOT_BLOCK_ADMIN: "Суперадмина нельзя заблокировать",
  TITLE_REQUIRED: "Введите название инструмента",
  TITLE_LENGTH: "Название — от 2 до 40 символов",
  DESCRIPTION_REQUIRED: "Напишите краткое описание",
  DESCRIPTION_LENGTH: "Описание — от 5 до 80 символов",
  DETAILS_TOO_LONG: "Подробное описание не длиннее 1000 символов",
  TEXT_INVALID: "Текст содержит недопустимые символы",
  PRICE_REQUIRED: "Укажите цену за день",
  PRICE_NOT_INTEGER: "Цена должна быть целым числом",
  PRICE_OUT_OF_RANGE: "Цена — от 1 000 до 10 000 000 сумов",
  PHONE_INVALID: "Введите номер в формате +998 XX XXX XX XX",
  PHONE_REQUIRED: "Введите номер телефона",
  ICON_INVALID: "Выберите тип инструмента",
  PHOTOS_INVALID: "Фото не подходят. Загрузите заново",
  PHOTOS_TOO_MANY: "Не более 3 фото",
  PHOTOS_REQUIRED: "Загрузите хотя бы одно фото",
  UPLOAD_REQUIRED: "Выберите файл изображения",
  UPLOAD_TOO_MANY: "За раз можно загрузить не более 3 фото",
  UPLOAD_MEDIA_TYPE: "Отправьте фото как multipart/form-data (поле «images»)",
  UPLOAD_IN_USE: "Это фото прикреплено к объявлению",
  UPLOAD_NOT_FOUND: "Фото не найдено",
  UPLOAD_INVALID: "Загрузите изображение JPG, PNG или WEBP",
  UPLOAD_TOO_LARGE: "Размер фото — не более 2 МБ",
  LISTING_NOT_FOUND: "Объявление не найдено",
  ALREADY_REVIEWED: "Это объявление уже проверено",
  DECISION_INVALID: "Выберите решение: approve или reject",
  REASON_TOO_LONG: "Причина не длиннее 200 символов",
  STATUS_INVALID: "Неверный статус",
  DEMO_RESET_DISABLED: "Сброс демо-данных отключён",
  MESSAGE_REQUIRED: "Напишите сообщение",
  MESSAGE_TOO_LONG: "Сообщение не длиннее 1000 символов",
  CANNOT_MESSAGE_SELF: "Нельзя написать на своё объявление",
  CONVERSATION_NOT_FOUND: "Чат не найден",
  DATE_INVALID: "Неверная дата",
  UNKNOWN_FIELD: "Неизвестное поле",
  INVALID_JSON: "Неверный формат данных запроса",
  UNSUPPORTED_MEDIA_TYPE: "Запрос должен быть в формате JSON",
  PAYLOAD_TOO_LARGE: "Слишком большой запрос",
  NOT_FOUND: "Адрес не найден",
  RATE_LIMITED: "Слишком много запросов. Повторите чуть позже",
  INTERNAL_ERROR: "Ошибка на сервере",
};

export type Lang = "uz" | "ru";

export function messageFor(code: ErrorCode, lang: Lang = "uz"): string {
  return lang === "ru" ? ERROR_MESSAGES_RU[code] : ERROR_MESSAGES[code];
}

/** Language from Accept-Language: "ru" when preferred, Uzbek otherwise. */
export function langOf(req: Request): Lang {
  return req.acceptsLanguages("uz", "ru") === "ru" ? "ru" : "uz";
}

export type FieldError = { code: ErrorCode; message: string };
export type FieldErrors = Record<string, FieldError>;

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === "string" && value in ERROR_MESSAGES;
}

export function fieldError(code: ErrorCode): FieldError {
  return { code, message: ERROR_MESSAGES[code] };
}

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    public readonly fields?: FieldErrors,
  ) {
    super(ERROR_MESSAGES[code]);
    this.name = "AppError";
  }

  toJSON(lang: Lang = "uz") {
    const fields = this.fields
      ? Object.fromEntries(
          Object.entries(this.fields).map(([k, f]) => [k, { code: f.code, message: messageFor(f.code, lang) }]),
        )
      : undefined;
    return {
      error: {
        code: this.code,
        message: messageFor(this.code, lang),
        ...(fields ? { fields } : {}),
      },
    };
  }
}

export function errorBody(code: ErrorCode, lang: Lang = "uz") {
  return { error: { code, message: messageFor(code, lang) } };
}
