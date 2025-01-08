const {
    Client,
    GatewayIntentBits,
    REST,
    Routes,
    SlashCommandBuilder,
    EmbedBuilder,
    ButtonStyle,
    PermissionsBitField,
    Events,
    Partials,
    ActionRowBuilder,
    ButtonBuilder,
    WebhookClient,
    MessageFlags,
    StringSelectMenuBuilder,
    ActivityType
} = require('discord.js');
const {
    UserStats,
    ClickStats,
    UserIds
} = require('./database');
const cron = require('node-cron');
require('dotenv').config();

const client = new Client({
    intents: [Object.keys(GatewayIntentBits)],
    partials: [Object.keys(Partials)]
})

const {
    TOKEN,
    CLIENT_ID,
    CHANNEL_ID,
    WEBHOOK_URL
} = process.env;

/**
 * U've Webhook
 */
const uve = new WebhookClient({
    url: WEBHOOK_URL
});

const state = {
    buttonPressed: false,
    uveUpdate: {},
    userIdsArray: []
};

const commands = [
    new SlashCommandBuilder()
    .setName('kickleaderboard')
    .setDescription('Display the kick leaderboard')
    .toJSON(),

    new SlashCommandBuilder()
    .setName('clickleaderboard')
    .setDescription('Display the button click leaderboard')
    .toJSON(),

    new SlashCommandBuilder()
    .setName('clearmsgs')
    .setDescription('Clear a number of messages from a specific user')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageMessages)
    .addUserOption(option =>
        option.setName('user')
        .setDescription('The user whose messages to delete')
        .setRequired(true)
    )
    .addIntegerOption(option =>
        option.setName('amount')
        .setDescription('Number of messages to delete (1-100)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    )
    .toJSON(),

    new SlashCommandBuilder()
    .setName('removerole')
    .setDescription('Remove a role from a specified user.')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageRoles)
    .addUserOption(option =>
        option.setName('user')
        .setDescription('The user to remove the role from')
        .setRequired(true)
    )
    .addRoleOption(option =>
        option.setName('role')
        .setDescription('The role to remove from the user')
        .setRequired(true)
    )
    .toJSON(),

    new SlashCommandBuilder()
    .setName('addrole')
    .setDescription('Assign a role to a specified user.')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageRoles)
    .addUserOption(option =>
        option.setName('user')
        .setDescription('The user to assign the role to')
        .setRequired(true)
    )
    .addRoleOption(option =>
        option.setName('role')
        .setDescription('The role to assign to the user')
        .setRequired(true)
    )
    .toJSON(),

    new SlashCommandBuilder()
    .setName('gkick')
    .setDescription('Kick one or more mentioned users or users by ID.')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.KickMembers)
    .addStringOption(option =>
        option.setName('users')
        .setDescription('Comma-separated list of mentions or user IDs to kick.')
        .setRequired(true)
    )
    .addBooleanOption(option =>
        option.setName('global')
        .setDescription('Kick users from all servers the bot has access to.')
        .setRequired(true)
    )
    .toJSON(),

    new SlashCommandBuilder()
    .setName('gban')
    .setDescription('Ban one or more mentioned users or users by ID.')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.BanMembers)
    .addStringOption(option =>
        option.setName('users')
        .setDescription('Comma-separated list of mentions or user IDs to ban.')
        .setRequired(true)
    )
    .addBooleanOption(option =>
        option.setName('global')
        .setDescription('Ban users from all servers the bot has access to.')
        .setRequired(true)
    )
    .toJSON(),

    new SlashCommandBuilder()
    .setName('bonk')
    .setDescription('Manage the bonk list')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageChannels)
    .addStringOption(option =>
        option.setName('action')
        .setDescription('Manage the bonk list (add or remove users)')
        .setRequired(true)
        .addChoices({
            name: 'add',
            value: 'add'
        }, {
            name: 'remove',
            value: 'remove'
        })
    )
    .addUserOption(option =>
        option.setName('user')
        .setDescription('User to bonk')
        .setRequired(true)
    )
    .toJSON(),
];


const rest = new REST({
    version: "10"
}).setToken(TOKEN);

(async () => {
    try {
        console.log("Refreshing application (/) commands...");
        await rest.put(Routes.applicationCommands(CLIENT_ID), {
            body: commands
        });
        console.log("Successfully reloaded application (/) commands.");
    } catch (error) {
        console.error("Error refreshing commands:", error);
    }
})();

client.once(Events.ClientReady, async () => {
    try {
        const updateActivity = async () => {
            state.userIdsArray = (await UserIds.find({}, 'userId')).map(user => user.userId);
            const userCount = state.userIdsArray.length;
            const status = userCount === 0 ? 'No bonk users to manage' : `Managing ${userCount} bonk users`;
            client.user.setPresence({
                activities: [{
                    name: status,
                    type: ActivityType.Watching
                }],
                status: 'dnd',
            });
        };

        await updateActivity();
        setInterval(updateActivity, 10000); // Update every 10 secs

        cron.schedule('* * * * *', async () => {
            if (state.buttonPressed) return;

            const guild = client.guilds.cache.first();
            const uveChannel = client.channels.cache.get(CHANNEL_ID);

            const members = await Promise.all(
                state.userIdsArray.map(userId => guild.members.fetch(userId).catch(() => null))
            );

            await Promise.all(members.map(async (member, index) => {
                if (!member) return;

                const username = member.user.username;
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                    .setCustomId(`kick_button_${state.userIdsArray[index]}`)
                    .setLabel(`Bonk ${username}`)
                    .setStyle(ButtonStyle.Danger)
                );

                const embed = new EmbedBuilder()
                    .setDescription(`Press the button to bonk ${username}`)
                    .setColor('Purple');

                const userState = state.uveUpdate[state.userIdsArray[index]];
                if (userState) {
                    await userState.edit({
                        embeds: [embed],
                        components: [row]
                    });
                } else {
                    state.uveUpdate[state.userIdsArray[index]] = await uveChannel.send({
                        embeds: [embed],
                        components: [row]
                    });
                }
            }));
        });

    } catch (error) {
        console.error('An error occurred:', error);
    }
});

client.on(Events.GuildMemberAdd, async (member) => {
    const userRoleMap = {
        "487060202621894657": "1210482229340274689", // "SNOW" : 'HEADMOD
        "1108162232774299729": "1308540258778091650" // "DUMBASS (mac's dumbass)" : "SERVER RETARD"
        /**
         * don't need to add anymore unless it's "SERVER RETARD"
         */
    };

    const roleId = userRoleMap[member.id];
    if (roleId) {
        const role = member.guild.roles.cache.get(roleId);

        try {
            // Assign the role based on the role map
            await member.roles.add(role);
        } catch (error) {
            console.error('Failed to assign role:', error);
        }
    }

    /**
     * so we don't spam the webhook. when people are getting kicked from bonk list 
     */
    if (state.userIdsArray.includes(member.id)) return;
    uve.send({
        embeds: [
            new EmbedBuilder()
            .setDescription(`${member.user.username} has joined the server.`)
            .setColor('Purple')
        ]
    })
});

client.on(Events.GuildMemberRemove, async (member) => {

    /**
     * so we don't spam the webhook. when people are getting kicked from bonk list 
     */
    if (state.userIdsArray.includes(member.id)) return;

    uve.send({
        embeds: [
            new EmbedBuilder()
            .setDescription(`${member.user.username} has left the server.`)
            .setColor('Purple')
        ]
    })
})

client.on(Events.GuildMemberRemove, async (member) => {
    const {
        user,
        guild
    } = member;

    try {
        /**
         * Fetch the audit logs to check for kicks
         * and kick audit logs is <20>
         */
        const auditLogs = await guild.fetchAuditLogs({
            type: 20,
            limit: 1
        });

        const logEntry = auditLogs.entries.first();
        if (logEntry && logEntry.target.id === user.id) {
            console.log(`User ${user.username} was kicked from ${guild.name}`);

            await UserStats.findOneAndUpdate({
                userId: user.id
            }, {
                $inc: {
                    kicks: 1
                }
            }, {
                upsert: true,
                new: true
            });

            /**
             * unfortunately, can't use this code because for some reason dms are still turned off makes no sense.
             */

            // we create the invite for snow, beause this mf keeps getting kicked HEHE
            // const invite = await guild.invites.create(guild.channels.cache.first(), {
            //     maxUses: 1,
            //     unique: true
            // });
            // console.log(`Invite created for ${user.username}: ${invite.url}`);

            // // send this mf a invite using his Id (i got lazy on sending him)
            // const uve = await client.users.fetch(TARGET_USER_ID)
            // try {
            //     await uve.send(`You have been re-invited to the server: ${invite.url}`);
            // } catch (dmError) {
            //     console.error(`Could not send DM to ${user.username}:`, dmError);
            // }
        }
    } catch (error) {
        console.error('Error updating kick count or sending invite:', error);
    }
});

client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isCommand() && !interaction.isButton()) return;

    if (interaction.isCommand()) {
        const {
            commandName: cmd,
            options
        } = interaction;

        switch (cmd) {
            case "bonk": {
                const action = options.getString('action');
                const user = options.getUser('user');

                if (!action || !user) {
                    return interaction.reply({
                        embeds: [
                            new EmbedBuilder()
                            .setDescription('Please provide both the action (`add` or `remove`) and the user.')
                            .setColor('Purple')
                        ],
                        flags: MessageFlags.Ephemeral,
                    });
                }

                const userId = user.id;

                try {
                    if (action === 'add') {
                        const existingUser = await UserIds.findOne({
                            userId
                        });
                        if (existingUser) {
                            return interaction.reply({
                                embeds: [
                                    new EmbedBuilder()
                                    .setDescription(`User ${user.username} is already in the "bonk" list.`)
                                    .setColor('Purple')
                                ],
                                flags: MessageFlags.Ephemeral,
                            });
                        }

                        await UserIds.create({
                            userId
                        });
                        state.userIdsArray.push(userId); // Update the state array with the new user

                        return interaction.reply({
                            embeds: [
                                new EmbedBuilder()
                                .setDescription(`User ${user.username} has been successfully added to the "bonk" list.`)
                                .setColor('Purple')
                            ],
                            flags: MessageFlags.Ephemeral,
                        });
                    } else if (action === 'remove') {
                        const result = await UserIds.deleteOne({
                            userId
                        });
                        if (result.deletedCount === 0) {
                            return interaction.reply({
                                embeds: [
                                    new EmbedBuilder()
                                    .setDescription(`User ${user.username} was not found in the "bonk" list.`)
                                    .setColor('Purple')
                                ],
                                flags: MessageFlags.Ephemeral,
                            });
                        }

                        state.userIdsArray = state.userIdsArray.filter(id => id !== userId); // Remove the user from the state array

                        return interaction.reply({
                            embeds: [
                                new EmbedBuilder()
                                .setDescription(`User ${user.username} has been successfully removed from the "bonk" list.`)
                                .setColor('Purple')
                            ],
                            flags: MessageFlags.Ephemeral,
                        });
                    }
                } catch (error) {
                    console.error('An error occurred:', error);
                    return interaction.reply({
                        embeds: [
                            new EmbedBuilder()
                            .setDescription('An error occurred while managing the "bonk" list. Please try again later.')
                            .setColor('Purple')
                        ],
                        flags: MessageFlags.Ephemeral,
                    });
                }
                break;
            }
        }
    } else if (interaction.isButton()) {
        const targetUserId = interaction.customId.split('_')[2]; // Extract target user ID from custom ID
        const userId = interaction.user.id;
        const username = interaction.user.username;

        if (userId === targetUserId) {
            return interaction.reply({
                content: "You can't bonk yourself!",
                ephemeral: true
            });
        }

        if (!state.userIdsArray.includes(targetUserId)) {
            return interaction.reply({
                content: "You are not allowed to use this button!",
                ephemeral: true
            });
        }

        const tMember = await interaction.guild.members.fetch(targetUserId).catch(() => null);
        if (!tMember) {
            return interaction.reply({
                content: "The user is not in the guild.",
                ephemeral: true
            });
        }

        console.log('Updating ClickStats for userId:', userId);
        await ClickStats.findOneAndUpdate({
            userId
        }, {
            $inc: {
                clicks: 1
            }
        }, {
            upsert: true,
            new: true
        });

        console.log('Sending message to uve channel for user:', {
            username,
            userId
        });
        await interaction.guild.members.kick(targetUserId, `Kicked by ${username} HEHE`);

        const sEmbed = new EmbedBuilder()
            .setDescription(`${tMember.user.username} has been kicked.`)
            .setColor('Purple');

        await interaction.update({
            embeds: [sEmbed],
            components: []
        });
    }
});


client.login(TOKEN);
