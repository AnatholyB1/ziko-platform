export interface FormQuestion {
  id: string;
  type: 'text' | 'scale' | 'yes_no' | 'choice';
  label: string;
  choices?: string[];
}

export interface PendingForm {
  instance_id: string;
  form_id: string;
  form_title: string;
  question_count: number;
  questions: FormQuestion[];
}

export interface FormAnswer {
  question_id: string;
  value: string | number;
}
