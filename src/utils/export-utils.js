// Copyright (c) 2020 Uber Technologies, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

import domtoimage from 'utils/dom-to-image';
import {
  Blob,
  URL,
  atob,
  Uint8Array,
  ArrayBuffer,
  document
} from 'global/window';
import {
  EXPORT_IMG_RESOLUTION_OPTIONS,
  EXPORT_IMG_RATIO_OPTIONS,
  RESOLUTIONS,
  EXPORT_IMG_RATIOS,
  EXPORT_DATA_TYPE
} from 'constants/default-settings';
import {exportMapToHTML} from 'templates/export-map-html';
import {formatCsv} from 'processors/data-processor';

import KeplerGlSchema from 'schemas';

/**
 * Default file names
 */
export const DEFAULT_IMAGE_NAME = 'kepler-gl.png';
export const DEFAULT_HTML_NAME = 'kepler.gl.html';
export const DEFAULT_JSON_NAME = 'keplergl.json';
export const DEFAULT_DATA_NAME = 'kepler-gl';

const defaultResolution = EXPORT_IMG_RESOLUTION_OPTIONS.find(
  op => op.id === RESOLUTIONS.ONE_X
);

const defaultRatio = EXPORT_IMG_RATIO_OPTIONS.find(op => op.id === EXPORT_IMG_RATIOS.FOUR_BY_THREE);

export function getScaleFromImageSize(imageW, imageH, mapW, mapH) {
  if ([imageW, imageH, mapW, mapH].some(d => d <= 0)) {
    return 1;
  }

  const base = imageW / imageH > 1 ? imageW : imageH;
  const mapBase = imageW / imageH > 1 ? mapW : mapH;
  const scale = base / mapBase;

  return scale;
}

export function calculateExportImageSize({mapW, mapH, ratio, resolution}) {
  if (mapW <= 0 || mapH <= 0) {
    return null;
  }

  const ratioItem = EXPORT_IMG_RATIO_OPTIONS.find(op => op.id === ratio) || defaultRatio;

  const resolutionItem =
    EXPORT_IMG_RESOLUTION_OPTIONS.find(op => op.id === resolution) || defaultResolution;

  const {width: scaledWidth, height: scaledHeight} = resolutionItem.getSize(
    mapW,
    mapH
  );

  const {width: imageW, height: imageH} = ratioItem.getSize(
    scaledWidth,
    scaledHeight
  );

  const {scale} = ratioItem.id === EXPORT_IMG_RATIOS.CUSTOM ?
    {} : resolutionItem;

  return {
    scale,
    imageW,
    imageH
  };
}

export function convertToPng(sourceElem, options) {
  return domtoimage.toPng(sourceElem, options);
}

export function dataURItoBlob(dataURI) {
  const binary = atob(dataURI.split(',')[1]);

  // separate out the mime component
  const mimeString = dataURI
    .split(',')[0]
    .split(':')[1]
    .split(';')[0];

  // write the bytes of the string to an ArrayBuffer
  const ab = new ArrayBuffer(binary.length);

  // create a view into the buffer
  const ia = new Uint8Array(ab);

  for (let i = 0; i < binary.length; i++) {
    ia[i] = binary.charCodeAt(i);
  }

  return new Blob([ab], {type: mimeString});
}

export function downloadFile(fileBlob, filename) {
  const url = URL.createObjectURL(fileBlob);

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportImage(state, options) {
  const {imageDataUri} = state.uiState.exportImage
  if (imageDataUri) {
    const file = dataURItoBlob(imageDataUri);
    downloadFile(file, DEFAULT_IMAGE_NAME);
  }
}

export function exportJson(state, options) {
  const {hasData} = options;

  const data = hasData
    ? KeplerGlSchema.save(state)
    : KeplerGlSchema.getConfigToSave(state);

  const fileBlob = new Blob([data], {type: 'application/json'});
  downloadFile(fileBlob, DEFAULT_JSON_NAME);
}

export function exportHtml(state, options) {
  const {userMapboxToken, exportMapboxAccessToken, mode} = options;

  const data = {
    ...KeplerGlSchema.save(state),
    mapboxApiAccessToken:
      (userMapboxToken || '') !== ''
        ? userMapboxToken
        : exportMapboxAccessToken,
    mode
  };

  const fileBlob = new Blob([exportMapToHTML(data)], {type: 'text/html'});
  downloadFile(fileBlob, DEFAULT_HTML_NAME);
}

export function exportData(state, option) {
  const {visState} = state;
  const {datasets} = visState;
  const {selectedDataset, dataType, filtered} = option;
  // get the selected data
  const filename = DEFAULT_DATA_NAME;
  const selectedDatasets = datasets[selectedDataset]
    ? [datasets[selectedDataset]]
    : Object.values(datasets);
  if (!selectedDatasets.length) {
    // error: selected dataset not found.
    return;
  }

  selectedDatasets.forEach(selectedData => {
    const {allData, fields, label, filteredIdxCPU = []} = selectedData;
    const toExport = filtered ? filteredIdxCPU.map(i => allData[i]) : allData;
    // start to export data according to selected data type
    switch (dataType) {
      case EXPORT_DATA_TYPE.CSV: {
        const csv = formatCsv(toExport, fields);

        const fileBlob = new Blob([csv], {type: 'text/csv'});
        downloadFile(fileBlob, `${filename}_${label}.csv`);
        break;
      }
      // TODO: support more file types.
      default:
        break;
    }
  });
}

export function exportMap(state, option) {
  const mapToState = KeplerGlSchema.save(state);
  const {mapInfo} = state.visState;
  const {imageDataUri} = state.uiState.exportImage;
  const thumbnail = imageDataUri ? dataURItoBlob(imageDataUri) : null

  return {
    map: mapToState,
    info: mapInfo,
    thumbnail
  };
}

const exporters = {
  exportImage,
  exportJson,
  exportHtml,
  exportData
};

export default exporters;