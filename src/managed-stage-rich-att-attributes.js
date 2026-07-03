export function richComponentAttAttributes(contract = {}, primitives = [], componentClass = '') {
  const geometry = contract.richGeometryEvidence || {};
  return {
    SOURCE_NAME: contract.sourceName || '',
    SOURCE_REF: contract.sourceElementId || contract.elementId || contract.name || '',
    NORMALIZED_DTXR: contract.dtxr || '',
    COMPONENT_CLASS: componentClass || contract.componentClass || '',
    CENTERLINE_KIND: contract.centerlineKind || '',
    ...pointAtt('START', contract.startMm),
    ...pointAtt('END', contract.endMm),
    LENGTH_MM: scalar(contract.lengthMm),
    DIAMETER_MM: scalar(contract.diameterMm),
    START_DIAMETER_MM: scalar(contract.startDiameterMm),
    END_DIAMETER_MM: scalar(contract.endDiameterMm),
    RADIUS_MM: scalar(contract.radiusMm),
    MATERIAL_NAME: contract.material || '',
    RICH_DIAMETER_FIELD: geometry.diameterField || '',
    RICH_START_DIAMETER_FIELD: geometry.startDiameterField || '',
    RICH_END_DIAMETER_FIELD: geometry.endDiameterField || '',
    RICH_BEND_RADIUS_FIELD: geometry.bendRadiusField || '',
    RICH_BEND_ANGLE_FIELD: geometry.bendAngleField || '',
    RICH_BEND_ANGLE_DERIVED: geometry.bendAngleDerivedFromElementLength ? 'YES' : 'NO',
    RICH_COMPONENT_EVIDENCE_JSON: stableJson(contract.richComponentEvidence || {}),
    ...bendAttAttributes(contract),
    ...primitiveAttSummary(primitives)
  };
}

export function richSupportAttAttributes(support = {}, markerId = '', userData = {}) {
  const position = pointArray(support.positionMm);
  return {
    SUPPORT_ID: support.supportId || support.id || '',
    SUPPORT_NAME: support.supportName || support.name || markerId,
    SUPPORT_KIND_RAW: support.supportKindRaw || support.kindRaw || support.rawType || '',
    SUPPORT_KIND_NORMALIZED: support.supportKindNormalized || userData.family || '',
    SUPPORT_FAMILY: userData.family || support.supportFamily || '',
    SUPPORT_NODE: userData.node || support.nodeNumber || support.node || '',
    SUPPORT_AXIS_RAW: userData.axisRaw || '',
    SUPPORT_AXIS_CANVAS: userData.axisCanvas || '',
    SUPPORT_AXIS_VECTOR: compactVector(support.axisVector),
    SUPPORT_PIPE_AXIS: support.pipeAxis || '',
    SUPPORT_PIPE_OD_MM: scalar(support.pipeOdMm),
    SUPPORT_PIPE_RADIUS_MM: scalar(support.pipeRadiusMm),
    SUPPORT_POSITION_X_MM: scalar(position[0]),
    SUPPORT_POSITION_Y_MM: scalar(position[1]),
    SUPPORT_POSITION_Z_MM: scalar(position[2]),
    SUPPORT_MATCHED_PIPE_REF: userData.matchedPipeRef || '',
    SUPPORT_MATCH_METHOD: userData.matchMethod || '',
    SUPPORT_CONFIDENCE: scalar(userData.confidence),
    SUPPORT_POPUP_REQUIRED: support.popupRequired ? 'YES' : 'NO',
    SUPPORT_WARNING_CODE: userData.warningCode || '',
    SUPPORT_WARNING_MESSAGE: userData.warningMessage || '',
    SUPPORT_SOURCE_PATH: userData.sourcePath || '',
    SUPPORT_SOURCE_TRACE_JSON: stableJson(supportTrace(support, userData))
  };
}

function bendAttAttributes(contract) {
  const arc = contract.arc || {};
  return {
    BEND_RADIUS_MM: scalar(arc.bendRadiusMm),
    BEND_ANGLE_DEG: scalar(arc.bendAngleDeg),
    BEND_SWEEP_RAD: scalar(arc.sweepAngleRad),
    BEND_CENTERLINE_KIND: contract.centerlineKind || '',
    BEND_CODE4_EXCLUDED: contract.excludeCode4Bend ? 'YES' : 'NO',
    BEND_DEGRADATION_REASON: contract.bendArcDegradationReason || ''
  };
}

function primitiveAttSummary(primitives) {
  const kinds = primitives.map((primitive) => primitive.kind || '').filter(Boolean);
  const recipes = primitives.map(primitiveRecipeName).filter(Boolean);
  const roles = primitives.map(primitiveRoleName).filter(Boolean);
  return {
    RVM_RECIPE_NAMES: uniquePipe(recipes),
    RVM_PRIMITIVE_KINDS: uniquePipe(kinds),
    RVM_PRIMITIVE_ROLES: uniquePipe(roles),
    RVM_CODE4_COUNT: String(countKinds(kinds, ['elbow', 'torus', 'code4'])),
    RVM_CODE7_COUNT: String(countKinds(kinds, ['snout', 'code7'])),
    RVM_CODE8_COUNT: String(countKinds(kinds, ['cylinder', 'code8'])),
    RVM_CODE9_COUNT: String(countKinds(kinds, ['sphere', 'code9'])),
    RVM_SNOUT_COUNT: String(countKinds(kinds, ['snout'])),
    RVM_SPHERE_COUNT: String(countKinds(kinds, ['sphere']))
  };
}

function primitiveRecipeName(primitive) {
  return primitive.recipeName || primitive.sourceIntent || primitive.localName || '';
}

function primitiveRoleName(primitive) {
  return primitive.primitiveRole || primitive.localName || primitive.kind || '';
}

function supportTrace(support, userData) {
  return {
    supportId: support.supportId || support.id || '',
    node: userData.node || support.nodeNumber || '',
    family: userData.family || support.supportFamily || '',
    matchedPipeRef: userData.matchedPipeRef || '',
    sourcePath: userData.sourcePath || '',
    sourceAttributes: userData.sourceAttributes || {},
    diagnostics: userData.diagnostics || []
  };
}

function pointAtt(prefix, point) {
  const values = pointArray(point);
  return {
    [`${prefix}_X_MM`]: scalar(values[0]),
    [`${prefix}_Y_MM`]: scalar(values[1]),
    [`${prefix}_Z_MM`]: scalar(values[2])
  };
}

function pointArray(point) {
  if (Array.isArray(point)) return [point[0], point[1], point[2]];
  if (point && typeof point === 'object') return [point.x ?? point.X, point.y ?? point.Y, point.z ?? point.Z];
  return ['', '', ''];
}

function compactVector(vector) {
  const values = pointArray(vector).map((value) => scalar(value));
  return values.every((value) => value === '') ? '' : values.join(',');
}

function uniquePipe(values) {
  return [...new Set(values)].join('|');
}

function countKinds(kinds, allowed) {
  return kinds.filter((kind) => allowed.includes(kind)).length;
}

function scalar(value) {
  return value === undefined || value === null ? '' : String(value);
}

function stableJson(value) {
  try {
    return JSON.stringify(value ?? {});
  } catch {
    return '{}';
  }
}
