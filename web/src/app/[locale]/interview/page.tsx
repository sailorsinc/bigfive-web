import { unstable_setRequestLocale } from 'next-intl/server';
import { useTranslations } from 'next-intl';
import { TranscriptUpload } from './transcript-upload';

interface Props {
  params: { locale: string };
}

export default function InterviewPage({ params: { locale } }: Props) {
  unstable_setRequestLocale(locale);
  const t = useTranslations('interview');

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">
          {t('title') || 'Interview Transcript Analysis'}
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {t('description') || 'Upload an interview transcript to analyze personality traits using the Big Five (OCEAN) model.'}
        </p>
      </div>

      <TranscriptUpload />
    </div>
  );
}
