export type Arc69Standard = 'arc69';

export type Arc69Properties = {
  [key: string]:
    | number
    | number[]
    | string
    | string[]
    | { [key: string]: number | number[] | string | string[] };
};

export type Arc69Payload = {
  standard: Arc69Standard;
  description?: string;
  external_url?: string;
  media_url?: string;
  properties?: Arc69Properties;
  mime_type?: string;
};
