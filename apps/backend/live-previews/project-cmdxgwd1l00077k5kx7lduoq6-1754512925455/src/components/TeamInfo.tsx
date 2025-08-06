```tsx
import React from 'react';

interface TeamMember {
  name: string;
  role: string;
  bio: string;
  avatar: string;
}

interface TeamInfoProps {
  teamName: string;
  teamMembers: TeamMember[];
}

const TeamInfo: React.FC<TeamInfoProps> = ({ teamName, teamMembers }) => {
  return (
    <div className="team-info">
      <h1>{teamName}</h1>
      <div className="team-members">
        {teamMembers.map((member, index) => (
          <div key={index} className="team-member">
            <img src={member.avatar} alt={member.name} />
            <h2>{member.name}</h2>
            <p>{member.role}</p>
            <p>{member.bio}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TeamInfo;
```