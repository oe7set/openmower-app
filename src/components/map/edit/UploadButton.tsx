'use client';

import ControlButton from '@/components/map/ControlButton';
import {useMapboxDraw} from '@/contexts/MapContext';
import {CloudUpload as UploadIcon} from '@mui/icons-material';
import type {FeatureCollection} from 'geojson';
import {useRef} from 'react';
import {useDialog} from 'react-dialog-async';
import {UploadModal} from './UploadModal';

export function UploadButton() {
  const draw = useMapboxDraw();
  const uploadModal = useDialog(UploadModal);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (event.target) event.target.value = '';

    const text = await file.text();
    let geojson: FeatureCollection;
    try {
      geojson = JSON.parse(text);
    } catch {
      console.error('Error parsing GeoJSON');
      alert('Invalid GeoJSON file');
      return;
    }

    const result = await uploadModal.open(geojson);
    if (!result || !draw) return;

    if (result.clearExisting) draw.deleteAll();
    result.features.forEach((feature) => draw.add(feature));
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".geojson,.json"
        onChange={handleFileUpload}
        style={{display: 'none'}}
      />
      <ControlButton
        position="bottom-right"
        icon={UploadIcon}
        title="Upload map"
        onClick={handleUploadClick}
        disabled={!draw}
      />
    </>
  );
}
