'use client';
import { useState } from 'react';
import { FileUploadRow, type UploadedDoc } from './FileUploadRow';

const DOC_TYPES: Array<{ type: UploadedDoc['type']; label: string }> = [
  { type: 'certification', label: 'Ajouter une certification' },
  { type: 'id_recto', label: "Carte d'identité — recto" },
  { type: 'id_verso', label: "Carte d'identité — verso" },
  { type: 'other', label: 'Ajouter un autre document' },
];

export function KycDocList({
  userId,
  apiUrl,
  jwt,
  initial,
  onChange,
}: {
  userId: string;
  apiUrl: string;
  jwt: string;
  initial?: UploadedDoc[];
  onChange: (docs: UploadedDoc[]) => void;
}) {
  const [docs, setDocs] = useState<UploadedDoc[]>(initial ?? []);

  const update = (newDocs: UploadedDoc[]) => {
    setDocs(newDocs);
    onChange(newDocs);
  };

  const isAtMax = docs.length >= 4;

  return (
    <div className="flex flex-col gap-2">
      {docs.length === 0 && (
        <p className="text-sm font-normal text-muted text-center py-4">
          Aucun document ajouté. Les documents sont optionnels mais renforcent votre profil.
        </p>
      )}

      {docs.map((doc, i) => (
        <FileUploadRow
          key={`${doc.type}-${i}`}
          docType={doc.type}
          label=""
          userId={userId}
          apiUrl={apiUrl}
          jwt={jwt}
          onUploaded={() => {}}
          uploaded={doc}
          onRemove={() => update(docs.filter((_, j) => j !== i))}
        />
      ))}

      {isAtMax ? (
        <p className="text-sm font-normal text-muted">
          Maximum 3 documents. Supprimez-en un pour ajouter un autre.
        </p>
      ) : (
        DOC_TYPES.filter((dt) => !docs.find((d) => d.type === dt.type)).map((dt) => (
          <FileUploadRow
            key={dt.type}
            docType={dt.type}
            label={dt.label}
            userId={userId}
            apiUrl={apiUrl}
            jwt={jwt}
            onUploaded={(doc) => update([...docs, doc])}
            onRemove={() => {}}
          />
        ))
      )}
    </div>
  );
}
