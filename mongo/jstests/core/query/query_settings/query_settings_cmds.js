// Tests query settings setQuerySettings command.
// @tags: [
//   directly_against_shardsvrs_incompatible,
//   featureFlagQuerySettings,
// ]
//
(function() {
'use strict';

const adminDB = db.getSiblingDB("admin");
const coll = db[jsTestName()];
const queryA = {
    find: coll.getName(),
    $db: db.getName(),
    filter: {a: 1}
};
const queryB = {
    find: coll.getName(),
    $db: db.getName(),
    filter: {b: "string"}
};
const nonExistentQueryShapeHash =
    "0000000000000000000000000000000000000000000000000000000000000000";
const querySettingsA = {
    indexHints: {allowedIndexes: ["a_1", {$natural: 1}]}
};
const querySettingsB = {
    indexHints: {allowedIndexes: ["b_1"]}
};
const queryShapeConfigurationA = {
    settings: querySettingsA,
    representativeQuery: queryA
};
const queryShapeConfigurationB = {
    settings: querySettingsB,
    representativeQuery: queryB
};

/**
 * Helper function to assert equality of QueryShapeConfigurations. In order to ease the assertion
 * logic, 'queryShapeHash' field is removed from the QueryShapeConfiguration prior to assertion.
 */
function assertQueryShapeConfiguration(expectedQueryShapeConfigurations) {
    const actualQueryShapeConfigurations =
        assert.commandWorked(adminDB.runCommand({getClusterParameter: "querySettings"}))
            .clusterParameters[0]
            .settingsArray;

    assert.eq(actualQueryShapeConfigurations.length,
              expectedQueryShapeConfigurations.length,
              actualQueryShapeConfigurations);

    actualQueryShapeConfigurations.forEach((cfg) => {
        delete cfg.queryShapeHash;
    });
    actualQueryShapeConfigurations.sort(bsonWoCompare);
    expectedQueryShapeConfigurations.sort(bsonWoCompare);

    assert.eq(actualQueryShapeConfigurations,
              expectedQueryShapeConfigurations,
              actualQueryShapeConfigurations);
}

// Ensure that query settings cluster parameter is empty.
{ assertQueryShapeConfiguration([]); }

// Ensure that setQuerySettings command fails for invalid input.
{
    assert.commandFailedWithCode(
        db.adminCommand({setQuerySettings: nonExistentQueryShapeHash, settings: querySettingsA}),
        7746401);
    assert.commandFailedWithCode(
        db.adminCommand({setQuerySettings: {notAValid: "query"}, settings: querySettingsA}),
        7746402);
    assert.commandFailedWithCode(
        db.adminCommand({setQuerySettings: queryA, settings: {notAValid: "settings"}}), 40415);
}

// Ensure that 'querySettings' cluster parameter contains QueryShapeConfiguration after invoking
// setQuerySettings command.
{
    assert.commandWorked(db.adminCommand({setQuerySettings: queryA, settings: querySettingsA}));
    assertQueryShapeConfiguration([queryShapeConfigurationA]);
}

// Ensure that 'querySettings' cluster parameter contains both QueryShapeConfigurations after
// invoking setQuerySettings command.
{
    assert.commandWorked(db.adminCommand({setQuerySettings: queryB, settings: querySettingsB}));
    assertQueryShapeConfiguration([queryShapeConfigurationA, queryShapeConfigurationB]);
}

// Remove all query settings by setting the settings array to an empty array.
{
    assert.commandWorked(
        adminDB.runCommand({setClusterParameter: {querySettings: {settingsArray: []}}}));
    assertQueryShapeConfiguration([]);
}
})();
