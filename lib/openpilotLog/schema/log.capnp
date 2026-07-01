using Cxx = import "/include/c++.capnp";
$Cxx.namespace("cereal");

@0xf3b1f17e25a4285b;

# Minimal schema for parsing modelV2 + liveCalibration out of rlog/qlog
# files, mirroring the real cereal/log.capnp wire layout exactly.
# Every Event union field ordinal (@N) is preserved so the union
# discriminant matches the real, complete schema bit-for-bit; fields
# we don't decode are typed Void (same pattern opendbc's own
# opendbc/car/rlog.capnp uses for its "subset of cereal/log.capnp").
# Vendored from https://github.com/commaai/openpilot (MIT licensed).

struct XYZTData @0xc3cbae1fd505ae80 {
  x @0 :List(Float32);
  y @1 :List(Float32);
  z @2 :List(Float32);
  t @3 :List(Float32);
  xStd @4 :List(Float32);
  yStd @5 :List(Float32);
  zStd @6 :List(Float32);
}

struct ModelDataV2 {
  frameId @0 :UInt32;
  frameIdExtra @20 :UInt32;
  frameAge @1 :UInt32;
  frameDropPerc @2 :Float32;
  timestampEof @3 :UInt64;
  modelExecutionTime @15 :Float32;
  rawPredictions @16 :Data;

  # predicted future position, orientation, etc..
  position @4 :XYZTData;
  orientation @5 :XYZTData;
  velocity @6 :XYZTData;
  orientationRate @7 :XYZTData;
  acceleration @19 :XYZTData;

  # prediction lanelines and road edges
  laneLines @8 :List(XYZTData);
  laneLineProbs @9 :List(Float32);
  laneLineStds @13 :List(Float32);
  roadEdges @10 :List(XYZTData);
  roadEdgeStds @14 :List(Float32);

  # Not decoded by the ported renderer (model_renderer.py never reads
  # meta/leads/leadsV3/confidence/action) — retyped to a placeholder of
  # the same wire "kind" (AnyPointer for pointer fields, UInt16 for the
  # enum) instead of vendoring LeadDataV2/LeadDataV3/MetaData/
  # ConfidenceClass/Action (which pull in LaneChangeState/
  # LaneChangeDirection and cascade further). This preserves every real
  # field's pointer/data-section slot rank exactly.
  leads @11 :List(Data);
  leadsV3 @18 :List(Data);
  meta @12 :AnyPointer;
  confidence @23: UInt16;
  action @26: AnyPointer;

  # Not decoded — retyped to AnyPointer (capnp built-in) instead of the
  # real Deprecated.LateralPlannerSolution so this stays a self-contained
  # schema, while still occupying the same pointer-section slot rank as
  # the real field (preserving the real schema's byte layout for every
  # other ModelDataV2 field).
  lateralPlannerSolutionDEPRECATED @25: AnyPointer;

  deprecated :group {
    temporalPose @21 :AnyPointer;
    gpuExecutionTime @17 :Float32;
    navEnabled @22 :Bool;
    locationMonoTime @24 :UInt64;
  }
}

struct LiveCalibrationData {
  calStatus @11 :Status;
  calCycle @2 :Int32;
  calPerc @3 :Int8;
  validBlocks @9 :Int32;

  # view_frame_from_road_frame
  # ui's is inversed needs new
  extrinsicMatrix @4 :List(Float32);
  # the direction of travel vector in device frame
  rpyCalib @7 :List(Float32);
  rpyCalibSpread @8 :List(Float32);
  wideFromDeviceEuler @10 :List(Float32);
  height @12 :List(Float32);


  enum Status {
    uncalibrated @0;
    calibrated @1;
    invalid @2;
    recalibrating @3;
  }

  deprecated :group {
    warpMatrix @0 :List(Float32);
    calStatus @1 :Int8;
    warpMatrix2 @5 :List(Float32);
    warpMatrixBig @6 :List(Float32);
  }
}

struct Event {
  logMonoTime @0 :UInt64;  # nanoseconds
  valid @67 :Bool = true;

  union {
    # *********** log metadata ***********
    initData @1 :Void;
    sentinel @73 :Void;

    # *********** bootlog ***********
    boot @60 :Void;

    # ********** openpilot daemon msgs **********
    can @5 :Void;
    controlsState @7 :Void;
    selfdriveState @130 :Void;
    gyroscope @99 :Void;
    accelerometer @98 :Void;
    magnetometer @95 :Void;
    lightSensor @96 :Void;
    temperatureSensor @97 :Void;
    pandaStates @81 :Void;
    peripheralState @80 :Void;
    radarState @13 :Void;
    liveTracks @131 :Void;
    sendcan @17 :Void;
    liveCalibration @19 :LiveCalibrationData;
    carState @22 :Void;
    carControl @23 :Void;
    carOutput @127 :Void;
    longitudinalPlan @24 :Void;
    driverAssistance @132 :Void;
    ubloxGnss @34 :Void;
    ubloxRaw @39 :Void;
    qcomGnss @31 :Void;
    gpsLocationExternal @48 :Void;
    gpsLocation @21 :Void;
    liveParameters @61 :Void;
    liveTorqueParameters @94 :Void;
    liveDelay @146 : Void;
    cameraOdometry @63 :Void;
    thumbnail @66: Void;
    onroadEvents @134: Void;
    carParams @69: Void;
    driverMonitoringState @151 :Void;
    livePose @129 :Void;
    modelV2 @75 :ModelDataV2;
    drivingModelData @128 :Void;
    driverStateV2 @92 :Void;

    # camera stuff, each camera state has a matching encode idx
    roadCameraState @2 :Void;
    driverCameraState @70: Void;
    wideRoadCameraState @74: Void;
    roadEncodeIdx @15 :Void;
    driverEncodeIdx @76 :Void;
    wideRoadEncodeIdx @77 :Void;
    qRoadEncodeIdx @90 :Void;

    livestreamRoadEncodeIdx @117 :Void;
    livestreamWideRoadEncodeIdx @118 :Void;
    livestreamDriverEncodeIdx @119 :Void;

    # microphone data
    soundPressure @103 :Void;
    rawAudioData @147 :Void;

    # systems stuff
    operatingSystemLog @20 :Void;
    managerState @78 :Void;
    procLog @33 :Void;
    clocks @35 :Void;
    deviceState @6 :Void;
    logMessage @18 :Void;
    errorLogMessage @85 :Void;

    # touch frame
    touch @135 :Void;

    # UI services
    uiDebug @102 :Void;

    # driving feedback
    userBookmark @93 :Void;
    bookmarkButton @148 :Void;
    audioFeedback @149 :Void;

    lateralManeuverPlan @150 :Void;

    # *********** debug ***********
    testJoystick @52 :Void;
    roadEncodeData @86 :Void;
    driverEncodeData @87 :Void;
    wideRoadEncodeData @88 :Void;
    qRoadEncodeData @89 :Void;
    alertDebug @133 :Void;

    livestreamRoadEncodeData @120 :Void;
    livestreamWideRoadEncodeData @121 :Void;
    livestreamDriverEncodeData @122 :Void;

    # *********** Custom: reserved for forks ***********

    # DO change the name of the field
    # DON'T change anything after the "@"
    customReservedRawData0 @124 :Void;
    customReservedRawData1 @125 :Void;
    customReservedRawData2 @126 :Void;

    # DO change the name of the field and struct
    # DON'T change the ID (e.g. @107)
    # DON'T change which struct it points to
    customReserved0 @107 :Void;
    customReserved1 @108 :Void;
    customReserved2 @109 :Void;
    customReserved3 @110 :Void;
    customReserved4 @111 :Void;
    customReserved5 @112 :Void;
    customReserved6 @113 :Void;
    customReserved7 @114 :Void;
    customReserved8 @115 :Void;
    customReserved9 @116 :Void;
    customReserved10 @136 :Void;
    customReserved11 @137 :Void;
    customReserved12 @138 :Void;
    customReserved13 @139 :Void;
    customReserved14 @140 :Void;
    customReserved15 @141 :Void;
    customReserved16 @142 :Void;
    customReserved17 @143 :Void;
    customReserved18 @144 :Void;
    customReserved19 @145 :Void;

    # *********** legacy + deprecated ***********
    model @9 :Void; # TODO: rename modelV2 and mark this as deprecated
    liveMpcDEPRECATED @36 :Void;
    liveLongitudinalMpcDEPRECATED @37 :Void;
    liveLocationKalmanDeprecatedDEPRECATED @51 :Void;
    orbslamCorrectionDEPRECATED @45 :Void;
    liveUIDEPRECATED @14 :Void;
    sensorEventDEPRECATED @4 :Void;
    liveEventDEPRECATED @8 :Void;
    liveLocationDEPRECATED @25 :Void;
    ethernetDataDEPRECATED @26 :Void;
    cellInfoDEPRECATED @28 :Void;
    wifiScanDEPRECATED @29 :Void;
    uiNavigationEventDEPRECATED @50 :Void;
    liveMapDataDEPRECATED @62 :Void;
    gpsPlannerPointsDEPRECATED @40 :Void;
    gpsPlannerPlanDEPRECATED @41 :Void;
    applanixRawDEPRECATED @42 :Void;
    androidGnssDEPRECATED @30 :Void;
    lidarPtsDEPRECATED @32 :Void;
    navStatusDEPRECATED @38 :Void;
    trafficEventsDEPRECATED @43 :Void;
    liveLocationTimingDEPRECATED @44 :Void;
    liveLocationCorrectedDEPRECATED @46 :Void;
    navUpdateDEPRECATED @27 :Void;
    orbObservationDEPRECATED @47 :Void;
    locationDEPRECATED @49 :Void;
    orbOdometryDEPRECATED @53 :Void;
    orbFeaturesDEPRECATED @54 :Void;
    applanixLocationDEPRECATED @55 :Void;
    orbKeyFrameDEPRECATED @56 :Void;
    orbFeaturesSummaryDEPRECATED @58 :Void;
    featuresDEPRECATED @10 :Void;
    kalmanOdometryDEPRECATED @65 :Void;
    uiLayoutStateDEPRECATED @57 :Void;
    pandaStateDEPRECATED @12 :Void;
    driverStateDEPRECATED @59 :Void;
    sensorEventsDEPRECATED @11 :Void;
    lateralPlanDEPRECATED @64 :Void;
    navModelDEPRECATED @104 :Void;
    uiPlanDEPRECATED @106 :Void;
    liveLocationKalmanDEPRECATED @72 :Void;
    liveTracksDEPRECATED @16 :Void;
    onroadEventsDEPRECATED @68: Void;
    gyroscope2DEPRECATED @100 :Void;
    accelerometer2DEPRECATED @101 :Void;
    temperatureSensor2DEPRECATED @123 :Void;
    driverMonitoringStateDEPRECATED @71 :Void;
    gpsNMEADEPRECATED @3 :Void;
    uploaderStateDEPRECATED @79 :Void;
    navInstructionDEPRECATED @82 :Void;
    navRouteDEPRECATED @83 :Void;
    navThumbnailDEPRECATED @84 :Void;
    gnssMeasurementsDEPRECATED @91 :Void;
    mapRenderStateDEPRECATED @105: Void;
  }
}

