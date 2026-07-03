// Vonage NCCO (Nexmo Call Control Object) builder
// These are JSON instructions sent back to Vonage to control call flow

export type NccoAction =
  | TalkAction
  | ConnectAction
  | InputAction
  | RecordAction;

export type TalkAction = {
  action: "talk";
  text: string;
  language?: string;
  style?: number;
  bargeIn?: boolean;
};

export type ConnectAction = {
  action: "connect";
  from: string;
  endpoint: ConnectEndpoint[];
  timeout?: number;
  limit?: number;
  machineDetection?: "continue" | "hangup";
  eventUrl?: string[];
  eventMethod?: string;
};

export type ConnectEndpoint = {
  type: "phone";
  number: string;
  dtmfAnswer?: string;
};

export type InputAction = {
  action: "input";
  type: string[];
  dtmf?: { maxDigits?: number; submitOnHash?: boolean; timeOut?: number };
  eventUrl?: string[];
};

export type RecordAction = {
  action: "record";
  format?: string;
  endOnSilence?: number;
  endOnKey?: string;
  beepStart?: boolean;
  eventUrl?: string[];
};

export function buildTalkJa(text: string, bargeIn = false): TalkAction {
  return {
    action: "talk",
    text,
    language: "ja-JP",
    style: 0,
    bargeIn,
  };
}

export function buildConnect(
  fromNumber: string,
  toNumber: string,
  eventBaseUrl: string,
  timeoutSeconds = 10
): ConnectAction {
  return {
    action: "connect",
    from: fromNumber,
    endpoint: [{ type: "phone", number: toNumber }],
    timeout: timeoutSeconds,
    eventUrl: [`${eventBaseUrl}/api/webhooks/call-event`],
    eventMethod: "POST",
  };
}

// NCCO for unknown number
export function unknownNumberNcco(): NccoAction[] {
  return [
    buildTalkJa(
      "おかけになった番号は、現在お取り扱いできない番号です。番号をご確認の上、おかけ直しください。"
    ),
  ];
}

// NCCO for no forward numbers configured
export function noForwardNumbersNcco(): NccoAction[] {
  return [
    buildTalkJa(
      "ただいま転送できる電話番号が登録されておりません。しばらく経ってからおかけ直しください。"
    ),
  ];
}

// NCCO for all numbers busy with queue
export function allBusyQueuedNcco(queuePosition: number): NccoAction[] {
  return [
    buildTalkJa(
      `ただいまオペレーターが大変込み合っております。あなたは現在${queuePosition}番目にお待ちです。このままお待ちになるか、しばらく経ってからおかけ直しください。`
    ),
  ];
}

// NCCO to forward call to a number
export function forwardCallNcco(
  fromNumber: string,
  toNumber: string,
  eventBaseUrl: string
): NccoAction[] {
  return [buildConnect(fromNumber, toNumber, eventBaseUrl, 10)];
}
