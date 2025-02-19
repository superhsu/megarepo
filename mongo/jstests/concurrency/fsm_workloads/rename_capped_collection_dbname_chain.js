/**
 * rename_capped_collection_dbname_chain.js
 *
 * Creates a capped collection and then repeatedly executes the renameCollection
 * command against it, specifying a different database name in the namespace.
 * The previous "to" namespace is used as the next "from" namespace.
 *
 * @tags: [
 *     # Rename between DBs with different shard primary is not supported
 *     assumes_unsharded_collection,
 *     requires_capped,
 *   ]
 */

export const $config = (function() {
    var data = {
        // Use the workload name as a prefix for the collection name,
        // since the workload name is assumed to be unique.
        prefix: 'rename_capped_collection_dbname_chain'
    };

    var states = (function() {
        function uniqueDBName(prefix, tid, num) {
            return prefix + tid + '_' + num;
        }

        function init(db, collName) {
            this.fromDBName = db.getName() + uniqueDBName(this.prefix, this.tid, 0);
            this.num = 1;
            var fromDB = db.getSiblingDB(this.fromDBName);

            var options = {capped: true, size: 4096};

            assertAlways.commandWorked(fromDB.createCollection(collName, options));
            assertAlways(fromDB[collName].isCapped());
        }

        function rename(db, collName) {
            var toDBName = db.getName() + uniqueDBName(this.prefix, this.tid, this.num++);
            var renameCommand = {
                renameCollection: this.fromDBName + '.' + collName,
                to: toDBName + '.' + collName,
                dropTarget: false
            };

            assertAlways.commandWorked(db.adminCommand(renameCommand));
            assertAlways(db.getSiblingDB(toDBName)[collName].isCapped());

            // Remove any files associated with the "from" namespace
            // to avoid having too many files open
            assertAlways.commandWorked(db.getSiblingDB(this.fromDBName).dropDatabase());

            this.fromDBName = toDBName;
        }

        return {init: init, rename: rename};
    })();

    var transitions = {init: {rename: 1}, rename: {rename: 1}};

    return {
        threadCount: 10,
        iterations: 20,
        data: data,
        states: states,
        transitions: transitions,
    };
})();
